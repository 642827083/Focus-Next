const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const lockJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf8"));
const version = packageJson.version;
const stageDir = path.join(rootDir, "dist-release");
const outputPath = path.join(rootDir, `Focus Next-v${version}.mnaddon`);
const zipPath = `${outputPath}.zip`;

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else fs.copyFileSync(sourcePath, destinationPath);
  }
}

if (fs.existsSync(outputPath)) {
  throw new Error(`正式包已存在，拒绝覆盖：${path.basename(outputPath)}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, "mnaddon.json"), "utf8"));
const lockVersion = lockJson.packages && lockJson.packages[""] && lockJson.packages[""].version;
if (manifest.version !== version || lockVersion !== version) {
  throw new Error(`版本不一致：package.json=${version}，package-lock.json=${lockVersion}，mnaddon.json=${manifest.version}`);
}

if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
copyDirectory(srcDir, stageDir);

if (!fs.existsSync(path.join(stageDir, "icon.png"))) {
  throw new Error("正式安装包缺少工具栏图标：src/icon.png");
}

const escapedSource = path.join(stageDir, "*").replace(/'/g, "''");
const escapedZip = zipPath.replace(/'/g, "''");
execFileSync("powershell.exe", [
  "-NoProfile",
  "-NonInteractive",
  "-Command",
  `Compress-Archive -Path '${escapedSource}' -DestinationPath '${escapedZip}' -Force`,
], { stdio: "inherit" });
fs.renameSync(zipPath, outputPath);
console.log(`Release build successful: ${path.basename(outputPath)}`);
