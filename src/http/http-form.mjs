import { Writable } from 'stream'
import { splitBuffer } from '../util.mjs'
import { END_EVENT, asyncQueue, asyncParallel } from '../async.mjs'
import TmpDir from '../tmp-dir.mjs'

/**
 * Buffer representation of the end of line characters.
 */
const EOL = Buffer.from('\r\n')

/**
 * Buffer representation of the separation characters.
 * Theses characters appear every start of a boundary and at the end of the last boundary.
 */
const SEP = Buffer.from('--')

/**
 * Regular expression to get the filename of a file submitted by a form.
 */
const REG_EXP_FILENAME = /filename="(.+)"\s*$/

/**
 * Regular expression to get the mime-type of a file submitted by a form.
 */
const REG_EXP_CONTENT_TYPE = /(\S+\/\S+)\s*$/

/**
 * Temporary directory to download submitted files.
 */
const TMP_DIR = new TmpDir(process.cwd(), () => '.' + TmpDir.DEFAULT_GENERATOR())

/**
 * Symbol to keep sure there aren't property name collision.
 * This symbol can retrieve a private method.
 */
const NEW_FILE_METHOD = Symbol('NEW FILE METHOD')

/**
 * Submitted file representation.
 */
class HttpFile {
  /**
   * Filename submitted.
   * @property
   * @readonly
   * @type {string}
   */
  filename

  /**
   * Content type submitted.
   * @property
   * @readonly
   * @type {string}
   */
  contentType

  /**
   * Write stream to the temporary file.
   * @property
   * @readonly
   * @type {import('fs').WriteStream}
   */
  stream

  /**
   * Pathname to the temporary file.
   * @property
   * @readonly
   * @type {string}
   */
  get path() {
    return this.stream.path
  }

  /**
   * Create a new submitted file.
   * @param {string} filename Filename submitted
   * @param {string} contentType Content type submitted.
   */
  constructor(filename, contentType) {
    this.filename = filename
    this.contentType = contentType
    this.stream = TMP_DIR.createWriteStream()
  }

  /**
   * Write into the temporary file.
   * @param {Uint8Array|string} data Data to write.
   * @param {(err?: Error) => void} callback Call when write can be redo.
   * @returns {void}
   */
  write(data, callback) {
    if (!this.stream.write(data)) {
      this.stream.once('drain', callback)
    } else {
      queueMicrotask(callback)
    }
  }

  /**
   * Close the temporary write file stream.
   * @param {(err?: Error) => void} callback Call when the stream is closed.
   * @returns {void}
   */
  close(callback) {
    this.stream.close(callback)
  }
}

/**
 * multipart/form-data representation.
 */
export default class HttpForm extends Writable {
  /**
   * Form boundary
   * @property
   * @public
   * @readonly
   * @type {Buffer}
   */
  boundary

  /**
   * Readed files
   * @property
   * @public
   * @readonly
   * @type {HttpFile[]}
   */
  files

  /**
   * Last readed file.
   * @property
   * @public
   * @readonly
   * @type {HttpFile|undefined}
   */
  get lastFile() {
    return this.files[this.files.length - 1]
  }

  /**
   * New multipart/form-data from the HTTP request content type.
   * @param {string} contentType HTTP request content type.
   * @param {import('stream').WritableOptions} [options] Writable options.
   */
  constructor(contentType, options) {
    super(options)
    this.boundary = Buffer.from('--' + contentType.match(/boundary=([^;]+)/)[1])
    this.files = []
  }

  /**
   * Extract submitted files.
   * @protected
   * @param {Buffer} chunk 
   * @param {string} encoding 
   * @param {() => void} callback
   * @returns {void}
   */
  _write(chunk, encoding, callback) {
    const queue = []
    let start = chunk.indexOf(this.boundary)
    let end = 0
    while (start !== -1) {
      if (this.files.length > 0) {
        queue.push(this.lastFile.write.bind(this.lastFile, chunk.subarray(end, start)))
      }
      if (SEP.compare(chunk, start + this.boundary.length, start + this.boundary.length + SEP.length) === 0) {
        end = chunk.length
        break
      }
      end = this[NEW_FILE_METHOD](chunk, start + this.boundary.length + EOL.length)
      start = chunk.indexOf(this.boundary, end)
    }
    if (end < chunk.length) {
      queue.push(this.lastFile.write.bind(this.lastFile, chunk.subarray(end)))
    }
    asyncQueue(queue).once(END_EVENT, callback)
  }

  /**
   * Close all the temporaries write streams.
   * @protected
   * @param {() => void} callback Call when all the write streams are close.
   * @returns {void}
   */
  _final(callback) {
    asyncParallel(this.files.map(f => f.close.bind(f)))
      .once(END_EVENT, callback)
  }

  /**
   * This method is call when a new submitted file is discover.
   * Read the firsts three lines to get the basics information on the submitted file.
   * Add a new submmited file into the 'files' property.
   * @param {Buffer} buf Reference buffer.
   * @param {number} start Starting index where the search can begin.
   * @returns {number} Buffer index after the firsts three lines are readed.
   */
  [NEW_FILE_METHOD](buf, start) {
    const itLine = splitBuffer(buf, EOL, start)
    // Content-Disposition: form-data; name="infile"; filename="file.txt"
    const first = itLine.next().value
    // Content-Type: text/plain
    const second = itLine.next().value
    // Empty line
    const third = itLine.next().value
    this.files.push(new HttpFile(
      REG_EXP_FILENAME.exec(first.toString())[1],
      REG_EXP_CONTENT_TYPE.exec(second.toString())[1]
    ))
    return third.end + EOL.length
  }
}
