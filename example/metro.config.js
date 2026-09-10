const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

// These four must resolve to exactly one copy. Two copies of Reanimated or
// gesture-handler load two native modules, and the second one's gestures
// never fire.
const singletons = [
  'react',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
]
config.resolver.extraNodeModules = singletons.reduce((acc, name) => {
  acc[name] = path.resolve(workspaceRoot, 'node_modules', name)
  return acc
}, {})

module.exports = config
