const MapSet = require('./MapSet');

/**
 * @class DistributionMap
 * @desc The distribution map data structure is capable of handling
 * duplex association between a resource and provider (e.g. Worker <-> Task)
 * while maintaining a total load of resources for least executed resource
 * balancing between providers.
 */
class DistributionMap {
  constructor() {
    this._mapSet = new MapSet();
    this._reverseMapSet = new MapSet();
    this._balance = new Map();
  }

  get size() {
    return this._mapSet.size;
  }

  get forEach() {
    return this._mapSet.forEach;
  }

  get [Symbol.iterator]() {
    return this._mapSet[Symbol.iterator];
  }

  add(provider) {
    this._mapSet.add(provider);
    this._balance.set(provider, 0);
  }

  allocateResource(resource) {
    const node = this.addResource(resource, this.getNextAvailableProvider());;
    return node;
  }

  addResource(resource, provider) {
    this._mapSet.add(provider, resource);
    this._reverseMapSet.add(resource, provider);

    return provider;
  }

  increment(provider, total) {
    this._balance.set(provider, (this._balance.get(provider) || 0) + (total || 1));
  }

  decrement(provider, total) {
    this._balance.set(provider, (this._balance.get(provider) || 0) - (total || 1));
  }

  getNextAvailableProvider() {
    let provider = null;
    let balance = Infinity;

    this._balance.forEach((total, p) => {
      if (total < balance) {
        balance = total;
        provider = p;
      }
    });

    return provider;
  }

  getResources(provider) {
    return this._mapSet.get(provider);
  }

  getProviders(resource) {
    return this._reverseMapSet.get(resource);
  }

  getAvailableProvider(resource) {
    let leastBalance = { provider: null, balance: 0 };

    (this.getProviders(resource) || []).forEach((provider) => {
      if (this._balance.get(provider) >= leastBalance.balance) leastBalance = { provider, balance: this._balance.get(provider) };
    });

    return leastBalance.provider;
  }

  delete(provider) {
    const nodes = this._mapSet.get(provider);

    // Cleanup from all maps
    this._mapSet.delete(provider);
    this._balance.delete(provider);
    nodes.forEach((b) => this._reverseMapSet.delete(a));

    return nodes;
  }
}

module.exports = DistributionMap;