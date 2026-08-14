[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$skills = @(
    "databricks-core",
    "databricks-apps",
    "databricks-apps-python",
    "databricks-app-design",
    "databricks-dabs",
    "databricks-docs",
    "databricks-python-sdk",
    "databricks-dbsql",
    "databricks-data-discovery",
    "databricks-unity-catalog"
) -join ","

databricks aitools install --path .agents/skills --skills $skills

