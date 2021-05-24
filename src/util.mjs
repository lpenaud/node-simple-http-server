import * as fs from 'fs/promises'
import { constants as fsConstants } from 'fs'

/**
 * Function that serves no purpose except to be called.
 * Useful for optional callback.
 * @returns {void}
 */
export const USELESS_FUNCTION = () => undefined

/**
 * The server only deal with the regular files and the directories.
 * @param {import('fs').Stats} st File stats.
 * @returns {boolean} true if the file is a regular one or a directory, otherwise false.
 */
export const STAT_FILTER = st => st.isDirectory() || st.isFile()

/**
 * Transform string to camel case.
 * @param {string} str String to transform.
 * @param {RegExp} [regExp] Regular expression to find the separating characters.
 * @returns {string} Transformed string.
 */
export function toCamelCase(str, regExp = /_|\-| /g) {
  let result = ""
  let start = 0
  let matchs
  const matched = (matchs = regExp.exec(str)) !== null
  let cond = matched
  while (cond) {
    result += str[start].toUpperCase() + str.substring(start + 1, matchs.index).toLowerCase()
    start = matchs.index + 1
    cond = (matchs = regExp.exec(str)) !== null
  }
  return !matched ? str.toLowerCase() : result.substr(0, 1).toLowerCase() 
    + result.substring(1)
    + str.substr(start, 1).toUpperCase()
    + str.substring(start + 1).toLowerCase()
}

/**
 * If the specified key is not already associated with a value (or is mapped to undefined),
 * attempts to compute its value using the given mapping function and enters it into this map.
 * @template K,V
 * @param {Map<K, V>} map Map to use.
 * @param {K} key Key with which the specified value is to be associated.
 * @param {(key: K) => V} mappingFunction The function to compute a value.
 * @returns {V} the current (existing or computed) value associated with the specified key.
 */
export function computeIfAbsentMap(map, key, mappingFunction) {
  let value = map.get(key)
  if (value === undefined) {
    value = mappingFunction(key)
    map.set(key, value)
  }
  return value
}

class SplitResult {
  /**
   * @public
   * @property
   * @type {Buffer} Reference buffer.
   */
  buf

  /**
   * @public
   * @property
   * @type {number} Start index.
   */
  start

  /**
   * @public
   * @property
   * @type {number} End index.
   */
  end

  /**
   * Construct a new instance.
   * @param {Buffer} buf Reference buffer.
   * @param {number} start Start index.
   * @param {number} end End index.
   */
  constructor(buf, start, end) {
    this.buf = buf
    this.start = start
    this.end = end
  }

  /**
   * Transforms the reference buffer into a string from the start index to the end index.
   * @param {string} [encoding] Optional encoding.
   * @returns {string} Representation of the result buffer as a string.
   */
  toString(encoding) {
    return this.buf.toString(encoding, this.start, this.end)
  }
}

/**
 * Iterate on a splitted buffer with the given separator.
 * @param {Buffer} buf Buffer to split.
 * @param {Uint8Array} sep Seperator.
 * @param {number} [start] Start index.
 * @returns {Generator<SplitResult, void, unknown>} Iterable on the splitted buffer.
 */
export function* splitBuffer(buf, sep, start = 0) {
  let end
  while ((end = buf.indexOf(sep, start)) !== -1) {
    yield new SplitResult(buf, start, end)
    start = end + sep.length
  }
  yield new SplitResult(buf, start, end)
}

/**
 * Move a file in two step:
 *  1. Copy the source file to the destination.
 *  2. Remove the source file.
 * @param {import('fs').PathLike} src A path to the source file.
 * @param {import('fs').PathLike} dest A path to the destination file.
 * @param {boolean} [overwrite] Indicate if the source can overwrite the destination.
 * @returns {Promise<void>}
 * @throws An EEXIST error if the parameter overwrite is true and the destination file exists.
 */
export async function moveFile(src, dest, overwrite = false) {
  await fs.copyFile(src, dest, overwrite ? fsConstants.COPYFILE_EXCL : undefined)
  await fs.rm(src)
}

/**
 * Test if an object is empty.
 * @param {object} object Object to test.
 * @returns {boolean} True is the object is empty, otherwise false.
 */
export function isEmpty(object) {
  for (const _ in object) {
    return false
  }
  return true
}

/**
 * @typedef DefaultValue
 * @property {string|symbol|number} key Object key.
 * @property {unknown} d Default value
 */

/**
 * Map default values if the given object haven't some properties.
 * @template T
 * @param {DefaultValue[]} keys Default values
 * @param {T} object Object to map.
 * @returns {T} Object with all required properties.
 */
export function defaultValues(keys, object = {}) {
  if (isEmpty(object)) {
    for (const { key, d } of keys) {
      object[key] = d
    }
    return object
  }
  for (const { key, d } of keys) {
    if (object[key] === undefined) {
      object[key] = d
    }
  }
  return object
}
