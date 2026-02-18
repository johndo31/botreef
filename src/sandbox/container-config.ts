import type { ContainerCreateOptions } from "dockerode";

export interface SandboxOptions {
  image: string;
  runtime: "runsc" | "runc";
  memoryMb: number;
  cpus: number;
  networkEnabled: boolean;
  workspacePath: string;
  allowedHosts?: string[];
}

export function buildContainerConfig(options: SandboxOptions): ContainerCreateOptions {
  const hostConfig: ContainerCreateOptions["HostConfig"] = {
    Memory: options.memoryMb * 1024 * 1024,
    NanoCpus: options.cpus * 1e9,
    ReadonlyRootfs: true,
    AutoRemove: false,
    Binds: [
      `${options.workspacePath}:/workspace:rw`,
    ],
    Tmpfs: {
      "/tmp": "rw,noexec,nosuid,size=512m",
      "/home": "rw,noexec,nosuid,size=256m",
    },
    SecurityOpt: ["no-new-privileges"],
    CapDrop: ["ALL"],
  };

  if (options.runtime === "runsc") {
    hostConfig.Runtime = "runsc";
  }

  if (!options.networkEnabled) {
    hostConfig.NetworkMode = "none";
  }

  return {
    Image: options.image,
    WorkingDir: "/workspace",
    Tty: false,
    OpenStdin: false,
    HostConfig: hostConfig,
    Env: [
      "HOME=/home",
      "NODE_ENV=production",
    ],
    Labels: {
      "botreef.managed": "true",
    },
  };
}
