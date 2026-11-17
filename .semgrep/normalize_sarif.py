import json
import os
import re
from pathlib import Path, PurePosixPath


CATCH_RULE = "semgrep.enforce-errorlogservice-in-catch"
CATCH_MARKER = re.compile(
    r"\s*}\s*catch\s*(?P<signature>\()\s*(?P<type>[\w\\]+(?:\s*\|\s*[\w\\]+)*)"
    r"\s+\$\w+\s*\)\s*\{\s*// nosemgrep: " + re.escape(CATCH_RULE)
)


def reviewed_catch(artifact, region, rule_id, source_root):
    if rule_id != CATCH_RULE or not isinstance(artifact, str):
        return False

    parts = PurePosixPath(artifact.replace("\\", "/")).parts
    line, column = region.get("startLine"), region.get("startColumn")
    if (
        len(parts) != 4
        or parts[:2] != ("backend", "src")
        or parts[2] not in {"Controllers", "Jobs"}
        or not parts[-1].endswith(".php")
        or ".." in parts
        or type(line) is not int
        or type(column) is not int
    ):
        return False

    source = source_root.joinpath(*parts)
    if not source.is_file():
        return False

    lines = source.read_text(encoding="utf-8").splitlines()
    if not 1 <= line <= len(lines):
        return False

    marker = CATCH_MARKER.fullmatch(lines[line - 1])
    if marker is None:
        return False
    # PHP matches can start at the type or at the opening parenthesis of
    # the same catch signature. The full line must contain exactly one catch.
    return column in (marker.start("signature") + 1, marker.start("type") + 1)


def normalize_sarif(sarif_path, normalized_path, *, custom, source_root=Path(".")):
    document = json.loads(sarif_path.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or not isinstance(document.get("runs"), list):
        raise ValueError("SARIF document does not contain a runs array")

    finding_count = 0
    for run in document["runs"]:
        if not isinstance(run, dict):
            raise ValueError("SARIF runs array contains a non-object entry")
        tool = run.get("tool", {})
        driver = tool.get("driver", {}) if isinstance(tool, dict) else None
        rules = driver.get("rules", []) if isinstance(driver, dict) else None
        if not isinstance(rules, list):
            raise ValueError("SARIF tool driver rules is not an array")
        for rule in rules:
            if not isinstance(rule, dict):
                raise ValueError("SARIF tool driver rules contains a non-object entry")
            properties = rule.get("properties")
            if isinstance(properties, dict):
                tags = properties.get("tags")
                if isinstance(tags, list) and len(tags) > 10:
                    properties["tags"] = tags[:10]

        results = run.get("results", [])
        if not isinstance(results, list):
            raise ValueError("SARIF run results is not an array")
        if custom:
            active = []
            suppressed = 0
            for finding in results:
                if not isinstance(finding, dict):
                    raise ValueError("SARIF run results contains a non-object entry")
                locations = finding.get("locations", [])
                physical = locations[0].get("physicalLocation", {}) if locations else {}
                artifact = physical.get("artifactLocation", {}).get("uri", "unknown")
                region = physical.get("region", {})
                rule_id = finding.get("ruleId", "unknown")
                location = f"{artifact}:{region.get('startLine', '?')} {rule_id}"

                # Pro SARIF also includes ignored matches. Check the rule-specific
                # marker at the reported exception type, which identifies one catch.
                if reviewed_catch(artifact, region, rule_id, source_root):
                    print(f"Reviewed Semgrep suppression: {location}")
                    suppressed += 1
                    continue

                message = finding.get("message", {}).get("text", "")
                print(f"Custom Semgrep: {location} {message}")
                active.append(finding)
            run["results"] = results = active
            print(f"Custom Semgrep: {suppressed} reviewed suppressions; {len(active)} active findings")
        finding_count += len(results)

    normalized_path.write_text(json.dumps(document, separators=(",", ":")), encoding="utf-8")
    return finding_count


def main():
    reports = (
        ("pro", Path("semgrep.sarif"), Path("semgrep-normalized.sarif")),
        ("custom", Path("semgrep-custom.sarif"), Path("semgrep-custom-normalized.sarif")),
    )
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as output:
        for label, sarif_path, normalized_path in reports:
            valid, count = False, 0
            try:
                count = normalize_sarif(sarif_path, normalized_path, custom=label == "custom")
                valid = True
            except FileNotFoundError:
                print(f"::error file={sarif_path}::No SARIF output was generated.")
            except (OSError, ValueError, AttributeError, TypeError) as error:
                print(f"::error file={sarif_path}::Failed to normalize SARIF: {error}")
            print(f"{label}_valid={str(valid).lower()}", file=output)
            print(f"{label}_findings={count}", file=output)


if __name__ == "__main__":
    main()
