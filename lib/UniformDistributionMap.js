const SortedSet = require('./SortedSet');

/**
 * @class UniformDistributionMap
 * @desc The UniformDistribution Map data structure is responsible for
 * maintaining a set of providers with a total load number of allocated
 * resources for least executed resource balancing between providers.
 */
class UniformDistributionMap {
  constructor() {
    this.sortedSet = new SortedSet();
  }

  get size() {
    return this.sortedSet.size;
  }

  get [Symbol.iterator]() {
    return this.sortedSet[Symbol.iterator];
  }

  forEach(handler) {
    this.sortedSet.forEach(handler);
  }

  add(provider) {
    this.sortedSet.add(provider, 0);
  }

  increment(provider, total) {
    this.sortedSet.add(provider, (this.sortedSet.getWeight(provider) || 0) + (total || 1));
  }

  decrement(provider, total) {
    this.sortedSet.add(provider, (this.sortedSet.getWeight(provider) || 0) - (total || 1));
  }

  getNextAvailableProvider() {
    return this.sortedSet[Symbol.iterator]().next().value;
  }

  getAvailableProvider(resource) {
    return this.sortedSet[Symbol.iterator]().next().value;
  }

  delete(provider) {
    this.sortedSet.delete(provider);
  }
}

module.exports = UniformDistributionMap;