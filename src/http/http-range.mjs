/**
 * Class which represent the HTTP 'content-range' header.
 * Support only bytes as unit.
 */
export default class HttpRange {

  /**
   * Range start.
   * Integer indicating the beginning of the range.
   * @property
   * @public
   * @readonly
   * @type {number}
   */
  start

  /**
   * Range end.
   * Integer indicating the end of the range.
   * @property
   * @public
   * @readonly
   * @type {number}
   */
  end

  /**
   * Size of the document.
   * @property
   * @public
   * @readonly
   * @type {number}
   */
  size

  /**
   * Content-Length
   * Integer indicating the length of the range.
   * @property
   * @public
   * @readonly
   * @type {number}
   */
  get length() {
    return this.end - this.start
  }

  /**
   * Unit of the range.
   * Support only bytes.
   * @property
   * @public
   * @readonly
   * @type {'bytes'}
   */
  get unit() {
    return 'bytes'
  }

  /**
   * Content-Range
   * HTTP Header representation as a string.
   * @property
   * @public
   * @readonly
   * @type {string}
   */
  get contentRange() {
    return `${this.unit} ${this.start}-${this.end}/${this.size}`
  }

  /**
   * New instance from file stats and HTTP request.
   * @param {import('fs').Stats} stats File stats.
   * @param {import('http').IncomingMessage} req HTTP request.
   */
  constructor(stats, req) {
    const matchs = /^bytes=([0-9]+)\-([0-9]+)?$/
      .exec(req.headers.range)
    if (matchs === null) {
      this.start = 0
      this.end = stats.size
    } else {
      this.start = parseInt(matchs[1])
      this.end = parseInt(matchs[2]) || stats.size
    }
    this.size = stats.size
  }

  /**
   * Set HTTP response headers.
   * @param {import('http').ServerResponse} res HTTP response.
   * @returns {void}
   */
  setHeader(res) {
    res.setHeader('Content-Length', this.length)
    if (this.size !== this.length) {
      res.setHeader('Content-Range', this.contentRange)
      res.setHeader('Accept-Range', this.unit)
      res.statusCode = 206
    } else {
      res.statusCode = 200
    }
  }
}
