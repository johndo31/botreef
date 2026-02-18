import Docker from "dockerode";
import { buildContainerConfig, type SandboxOptions } from "./container-config.js";
import { demuxStream } from "./stream.js";
import { logger } from "../util/logger.js";

let _docker: Docker | null = null;

function getDocker(): Docker {
  if (!_docker) {
    _docker = new Docker();
  }
  return _docker;
}

let _defaultOptions: Partial<SandboxOptions> = {};

export function configureSandbox(options: Partial<SandboxOptions>): void {
  _defaultOptions = options;
}

export async function createSandbox(workspacePath: string): Promise<string> {
  const docker = getDocker();
  const options: SandboxOptions = {
    image: _defaultOptions.image ?? "botreef-sandbox:latest",
    runtime: _defaultOptions.runtime ?? "runc",
    memoryMb: _defaultOptions.memoryMb ?? 2048,
    cpus: _defaultOptions.cpus ?? 1,
    networkEnabled: _defaultOptions.networkEnabled ?? false,
    workspacePath,
    allowedHosts: _defaultOptions.allowedHosts,
  };

  const config = buildContainerConfig(options);
  const container = await docker.createContainer(config);
  await container.start();

  const id = container.id;
  logger.info({ containerId: id, image: options.image }, "Sandbox created");
  return id;
}

export async function execInSandbox(
  containerId: string,
  command: string[],
  onOutput?: (output: string) => void,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: "/workspace",
  });

  const stream = await exec.start({ hijack: true, stdin: false });
  const output = await demuxStream(
    stream,
    onOutput,
    (data) => onOutput?.(data),
  );

  const inspect = await exec.inspect();
  const exitCode = inspect.ExitCode ?? 1;

  logger.info({ containerId, exitCode }, "Sandbox exec completed");
  return { exitCode, ...output };
}

export async function destroySandbox(containerId: string): Promise<void> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  try {
    await container.stop({ t: 5 });
  } catch {
    // Container may already be stopped
  }

  try {
    await container.remove({ force: true });
  } catch {
    // Container may already be removed
  }

  logger.info({ containerId }, "Sandbox destroyed");
}

export async function listSandboxes(): Promise<string[]> {
  const docker = getDocker();
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ["botreef.managed=true"] },
  });
  return containers.map((c) => c.Id);
}
