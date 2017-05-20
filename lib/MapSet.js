class MapSet {
  constructor() {
    this.map = new Map();
  }

  get forEach() {
    return this.map.forEach.bind(this.map);
  }

  get size() {
    return this.map.size;
  }

  get [Symbol.iterator]() {
    return this.map[Symbol.iterator].bind(this.map);
  }

  set(key, ...values) {
    this.map.set(key, new Set(values));
  }

  get(key) {
    return this.map.get(key);
  }

  has(key) {
    return this.map.has(key);
  }

  add(key, ...values) {
    const set = this.map.get(key) || new Set();
    values.forEach((v) => set.add(v));
    this.map.set(key, set);
  }

  remove(key, ...values) {
    if (!this.map.has(key)) return false;
    const set = this.map.get(key);
    values.forEach((v) => set.delete(v));
    return true;
  }

  delete(key) {
    return this.map.delete(key);
  }
}

module.exports = MapSet;