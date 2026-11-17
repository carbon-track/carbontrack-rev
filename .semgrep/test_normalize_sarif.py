import json
import tempfile
import unittest
from pathlib import Path

from normalize_sarif import CATCH_RULE, normalize_sarif


class NormalizeSarifTest(unittest.TestCase):
    def test_only_the_marked_catch_for_the_matching_rule_is_filtered(self):
        artifact = "backend/src/Controllers/Fixture.php"
        source_lines = [
            "<?php",
            "try { // nosemgrep: " + CATCH_RULE,
            "    runTask();",
            "} catch (\\InvalidArgumentException $expected) { // nosemgrep: " + CATCH_RULE,
            "    return 422;",
            "} catch (\\Throwable $unexpected) {",
            "    return 500;",
            "}",
            "try {",
            "    runTask();",
            "} catch (\\RuntimeException $other) { // nosemgrep",
            "    return 500;",
            "}",
        ]

        def finding(line, rule=CATCH_RULE, column=None):
            return {
                "ruleId": rule,
                "locations": [{
                    "physicalLocation": {
                        "artifactLocation": {"uri": artifact},
                        "region": {
                            "startLine": line,
                            "startColumn": column or source_lines[line - 1].find("\\") + 1,
                        },
                    },
                }],
            }

        signature_start = source_lines[3].find("(") + 1
        active = [finding(6), finding(4, "semgrep.another-rule"), finding(4, column=1), finding(2), finding(11)]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / artifact
            source.parent.mkdir(parents=True)
            source.write_text("\n".join(source_lines), encoding="utf-8")
            raw, normalized = root / "raw.sarif", root / "normalized.sarif"
            raw.write_text(json.dumps({"runs": [{"results": [finding(4), finding(4, column=signature_start), *active]}]}), encoding="utf-8")

            self.assertEqual(
                normalize_sarif(raw, normalized, custom=True, source_root=root),
                len(active),
            )
            self.assertEqual(json.loads(normalized.read_text(encoding="utf-8"))["runs"][0]["results"], active)


if __name__ == "__main__":
    unittest.main()
