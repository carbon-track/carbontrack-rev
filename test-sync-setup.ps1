#!/usr/bin/env pwsh

# Test script for repository synchronization setup
# This script helps verify that the sync setup is working correctly

Write-Host "🧪 Repository Sync Test Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Function to test if a directory exists and has content
function Test-DirectoryContent {
    param(
        [string]$Path,
        [string]$Name
    )
    
    if (Test-Path $Path) {
        $fileCount = (Get-ChildItem $Path -Recurse -File).Count
        Write-Host "✅ $Name directory exists with $fileCount files" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $Name directory not found at $Path" -ForegroundColor Red
        return $false
    }
}

# Function to test if GitHub Actions workflow exists
function Test-WorkflowFile {
    param(
        [string]$Path
    )
    
    if (Test-Path $Path) {
        Write-Host "✅ GitHub Actions workflow file exists" -ForegroundColor Green
        
        # Check if the workflow has the correct triggers
        $content = Get-Content $Path -Raw
        if ($content -match "push:" -and $content -match "branches.*main") {
            Write-Host "  ✅ Push trigger configured for main branch" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Push trigger may not be properly configured" -ForegroundColor Yellow
        }
        
        if ($content -match "FRONTEND_REPO_TOKEN" -and $content -match "BACKEND_REPO_TOKEN") {
            Write-Host "  ✅ Required secrets referenced in workflow" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Required secrets not found in workflow" -ForegroundColor Red
        }
        
        return $true
    } else {
        Write-Host "❌ GitHub Actions workflow file not found" -ForegroundColor Red
        return $false
    }
}

# Function to create a test change
function New-TestChange {
    param(
        [string]$Directory,
        [string]$Name
    )
    
    $testFile = Join-Path $Directory "test-sync-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    $testContent = "Test sync change created at $(Get-Date)`nThis file was created to test the repository synchronization setup."
    
    try {
        Set-Content -Path $testFile -Value $testContent
        $fileName = Split-Path $testFile -Leaf
        Write-Host "✅ Created test file in ${Name}: $fileName" -ForegroundColor Green
        return $testFile
    } catch {
        Write-Host "❌ Failed to create test file in ${Name}: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Main test execution
Write-Host "`n📁 Checking directory structure..." -ForegroundColor Yellow

$frontendExists = Test-DirectoryContent -Path ".\frontend" -Name "Frontend"
$backendExists = Test-DirectoryContent -Path ".\backend" -Name "Backend"

Write-Host "`n🔧 Checking GitHub Actions setup..." -ForegroundColor Yellow

$workflowExists = Test-WorkflowFile -Path ".\.github\workflows\sync-repositories.yml"

Write-Host "`n📋 Setup status summary:" -Foregroundcolor Yellow

if ($frontendExists -and $backendExists -and $workflowExists) {
    Write-Host "✅ All required components are in place!" -ForegroundColor Green
    
    Write-Host "`n🔄 Would you like to create test changes? (y/n): " -ForegroundColor Cyan -NoNewline
    $response = Read-Host
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "`n📝 Creating test changes..." -ForegroundColor Yellow
        
        $frontendTestFile = New-TestChange -Directory ".\frontend" -Name "Frontend"
        $backendTestFile = New-TestChange -Directory ".\backend" -Name "Backend"
        
        if ($frontendTestFile -or $backendTestFile) {
            Write-Host "`n🚀 Test files created! Next steps:" -ForegroundColor Green
            Write-Host "1. Commit and push these changes to the main branch" -ForegroundColor White
            Write-Host "2. Check the Actions tab in your GitHub repository" -ForegroundColor White
            Write-Host "3. Verify that changes appear in individual repositories" -ForegroundColor White
            Write-Host "`nCommands to commit:" -ForegroundColor Cyan
            Write-Host "git add ." -ForegroundColor Gray
            Write-Host "git commit -m `"test: verify repository sync setup`"" -ForegroundColor Gray
            Write-Host "git push origin main" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "❌ Setup incomplete. Please check the issues above." -ForegroundColor Red
}

Write-Host "`n📚 Additional steps needed:" -ForegroundColor Yellow
Write-Host "1. Add FRONTEND_REPO_TOKEN secret to GitHub repository settings" -ForegroundColor White
Write-Host "2. Add BACKEND_REPO_TOKEN secret to GitHub repository settings" -ForegroundColor White
Write-Host "3. Ensure tokens have 'repo' and 'workflow' permissions" -ForegroundColor White
Write-Host "4. See SYNC_SETUP.md for detailed instructions" -ForegroundColor White

Write-Host "`n🎉 Test completed!" -ForegroundColor Cyan