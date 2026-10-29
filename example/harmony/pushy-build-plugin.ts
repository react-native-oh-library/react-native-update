// Register metadata generation before resource compilation, including IDE builds.
// The task follows the lifecycle used by upstream harmony/hvigor-plugin.ts.
import * as path from 'path';

const { writePushyBuildMetadata } = require('../scripts/pushy-build-metadata');

interface ModuleNode {
  getNodePath(): string;
  getParentNode(): { getNodePath(): string };
  getContext(pluginId: string): { getBuildMode(): string } | undefined;
  registerTask(task: {
    name: string;
    run: () => void;
    dependencies: string[];
    postDependencies: string[];
  }): void;
}

export function pushyBuildPlugin() {
  return {
    pluginId: 'pushyBuildMetadata',
    apply(node: ModuleNode) {
      // IDE sync and clean must not change the binary identity.
      if (!process.argv.some(arg => /^(?:[^@]+@)?assemble/i.test(arg))) {
        return;
      }
      node.registerTask({
        name: 'pushyWriteBuildMetadata',
        dependencies: ['default@PreBuild'],
        postDependencies: ['default@ProcessResource'],
        run() {
          const context = node.getContext('ohosHapPlugin');
          const modeArg = process.argv.find(arg => arg.startsWith('buildMode='));
          const buildMode = context?.getBuildMode() ??
            modeArg?.substring('buildMode='.length) ?? 'debug';
          const moduleDir = node.getNodePath();
          const projectDir = node.getParentNode()?.getNodePath() ?? path.dirname(moduleDir);
          const meta = writePushyBuildMetadata(moduleDir, projectDir, buildMode);
          console.log(`[pushy] ${buildMode} ${meta.versionName}, build time ${meta.pushy_build_time}`);
        },
      });
    },
  };
}
