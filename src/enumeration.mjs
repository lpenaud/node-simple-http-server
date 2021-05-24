/**
 * Symbol to get the size of an enumeration.
 */
const SIZE = Symbol('Enumeration.SIZE')

/**
 * @implements {Iterable<string>}
 */
export default class Enumeration {
  /**
   * Symbol to get the size of an enumeration.
   * @property
   * @public
   * @static
   * @readonly
   * @type {Symbol}
   */
  static get SIZE() {
    return SIZE
  }

  /**
   * Build a new freeze enumeration.
   * @param {...string} values Values of the new enumeration.
   */
  constructor(...values) {
    let i = 0
    for (const value of values) {
      this[i] = value
      this[value] = i++
    }
    this[SIZE] = i
    Object.freeze(this)
  }

  /**
   * Iterator method
   * @method
   * @returns {IterableIterator<string>} Iterator.
   */
  [Symbol.iterator] = () => {
    let i = 0
    return {
      next: () => {
        if (this[i] === undefined) {
          return { done: true }
        }
        return {
          value: this[i++],
          done: false,
        }
      }
    }
  }
}
