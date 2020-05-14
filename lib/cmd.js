module.exports = {
  "Global Commands": [
    {
      cmd: "create",
      description: "Create a new application",
      display: false,
    },
    {
      cmd: "module",
      description: "Manage modules",
      status: "beta",
      text: "Utility to create omneedia client modules",
      subcommands: [
        {
          cmd: "create",
          description: "Create a blank module",
        },
      ],
    },
    {
      cmd: "login",
      description: "Log in to Omneedia",
      display: false,
    },
    {
      cmd: "logout",
      description: "Log out of Omneedia",
    },
    {
      cmd: "project",
      description: "Manage projects",
      subcommands: ["list", "create", "delete"],
    },
    {
      cmd: "package",
      description: "Manage package",
      subcommands: ["list", "create", "delete"],
    },
    {
      cmd: "config",
      description: "Manage CLI and project config values",
      text:
        "These commands are used to programmatically read, write, and delete CLI and     project config values.",
      subcommands: [
        {
          cmd: "load",
          description: "loading a configuration",
        },
        {
          cmd: "save",
          description: "saving a configuration",
        },
        {
          cmd: "get",
          description: "Print config values",
        },
        {
          cmd: "set",
          description: "Set config value",
        },
        {
          cmd: "unset",
          description: "Delete config value",
        },
        "delete",
      ],
    },
    {
      cmd: "docs",
      description: "open the Omneedia documentation website.",
    },
    {
      cmd: "db",
      description: "Database management tool",
      subcommands: [
        {
          cmd: "start",
          description: "start MySQL engine",
        },
        {
          cmd: "stop",
          description: "stop MySQL engine",
        },
      ],
    },
  ],
  "Package commands|pkg": [
    {
      cmd: "start",
      description: "Start a local dev server for app dev/testing",
    },
    {
      cmd: "build",
      description: "Build app",
    },
    {
      cmd: "module",
      description: "Module management tool",
      status: "beta",
      subcommands: [
        {
          cmd: "build",
          description: "build an omneedia module",
        },
        {
          cmd: "install",
          description: "install an omneedia module inside your package",
        },
        {
          cmd: "uninstall",
          description: "uninstall an omneedia module",
        },
      ],
    },
    {
      cmd: "package",
      description: "Package management tool",
      subcommands: [
        {
          cmd: "install",
          description: "install a nodejs module inside your package",
        },
        {
          cmd: "uninstall",
          description: "uninstall a nodejs module",
        },
      ],
    },
  ],
};
