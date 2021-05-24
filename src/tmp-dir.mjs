import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'
import { createWriteStream, mkdtempSync } from 'fs'

/**
 * Function to generate a unique base name for a temporary file in the previously generated temporary directory.
 * @callback BasenameGenerator
 * @returns {string} Generate file name.
 */

/**
 * Join the path of the OS temporary directory with the given prefix.
 * @param {string} prefix 
 * @returns {string} Joined paths.
 */
function join(prefix) {
  return path.join(os.tmpdir(), prefix + '-')
}

export default class TmpDir {
  /**
   * Default basename generator.
   * @property
   * @public
   * @static
   * @type {BasenameGenerator}
   */
  static DEFAULT_GENERATOR = () => process.uptime().toString(36)

  /**
   * Build a new instance asynchronously.
   * @param {string} prefix Prefix of the generate name.
   * @param {string|{ encoding: string }} options Specify the encoding to use.
   * @returns {TmpDir} New unique temporary directory.
   */
  static async newInstance(prefix, options) {
    return new TmpDir(await fs.mkdtemp(join(prefix), options), TmpDir.DEFAULT_GENERATOR)
  }

  /**
   * Build a new instance synchronously.
   * @param {string} prefix Prefix of the generate name.
   * @param {string|{ encoding: string }} options Specify the encoding to use.
   * @returns {TmpDir} New unique temporary directory.
   */
  static newInstanceSync(prefix, options) {
    return new TmpDir(mkdtempSync(join(prefix), options), TmpDir.DEFAULT_GENERATOR)
  }

  /**
   * Build a instance with the given directory.
   * @param {string} dir Temporary directory.
   * @returns {TmpDir} New instance.
   */
  static fromDir(dir) {
    return new TmpDir(dir, TmpDir.DEFAULT_GENERATOR)
  }

  /**
   * Temporary directory pathname.
   * @property
   * @public
   * @readonly
   * @type {string}
   */
  dir

  /**
   * Basename generator.
   * @property
   * @public
   * @type {BasenameGenerator}
   */
  generator

  /**
   * Construct a new instance with the given directory and the basename generator.
   * @param {string} dir Temporary directory pathname.
   * @param {BasenameGenerator} generator Basename generator.
   */
  constructor(dir, generator) {
    this.dir = dir
    this.generator = generator
  }

  /**
   * Create a new write stream in the temporary directory.
   * The basename of the file is generated.
   * @param options 
   */
  createWriteStream(options) {
    return createWriteStream(path.join(this.dir, this.generator()), options)
  }
}
