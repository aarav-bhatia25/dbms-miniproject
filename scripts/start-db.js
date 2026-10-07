import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

let result = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
let command = "docker";
let args = ["compose"];
if (result.status !== 0) {
  const macPlugin =
    "/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose";
  command = existsSync(macPlugin) ? macPlugin : "docker-compose";
  args = [];
}
result = spawnSync(command, [...args, "up", "-d", "--wait"], {
  stdio: "inherit",
});
if (result.error)
  console.error(
    "Docker Compose is required. Start Docker Desktop and try again.",
  );
process.exit(result.status ?? 1);
