import { Console } from 'console'
import { USELESS_FUNCTION } from '../util.mjs'
import { defaultValues } from '../util.mjs'
import Enumeration from '../enumeration.mjs'

/**
 * Logger options.
 * @typedef LoggerOptions
 * @extends {NodeJS.ConsoleConstructorOptions}
 * @property {number} level Maximum logging level (use LEVELS enumeration).
 * @property {Intl.DateTimeFormatOptions} dateTimeFormat Date time format options.
 */

/**
 * Function which supply a string.
 * @callback StringSupplier
 * @param {...any} args[] Optionals arguments.
 * @returns {string|string[]} Supplied string·s.
 */

/**
 * Symbol to a special method of the logger.
 */
const INFO_METHOD = Symbol('INFO METHOD')

/**
 * Enumeration of the differents levels of logging.
 */
const LEVELS = new Enumeration('error', 'warn', 'log', 'info', 'debug')

export default class HttpLogger extends Console {
  /**
   * The enumeration of the differents levels of logging.
   * @property
   * @static
   * @readonly
   * @type {Enumeration}
   */
  static get LEVELS() {
    return LEVELS
  }

  /**
   * Merge the given logger options with the defaults.
   * @param {LoggerOptions} [options] Options
   * @returns {LoggerOptions} The logger options merged with the defaults.
   */
  static getOptions(options) {
    return defaultValues([
      { key: 'stderr', d: process.stderr },
      { key: 'stdout', d: process.stdout },
      { key: 'level', d: LEVELS.info },
      {
        key: 'dateTimeFormat',
        d: {
          dateStyle: 'short',
          timeStyle: 'short',
        },
      },
    ], options)
  }

  /**
   * Instanciate a new HTTP logger.
   * @param {LoggerOptions} [options] Instance options.
   */
  constructor(options) {
    super(options = HttpLogger.getOptions(options))
    this._dateTimeFormat = new Intl.DateTimeFormat([], options.dateTimeFormat)
    for (let i = options.level + 1; i < LEVELS[Enumeration.SIZE]; i++) {
      this[LEVELS[i]] = USELESS_FUNCTION
    }
  }
  
  /**
   * Log a info message.
   * If the first argument is a function, it will be call with the others arguments if the level of logging supported.
   * By default info level is active.
   * @param {StringSupplier|any} supplier String supplier or anythings.
   * @param {...any} args Optinals arguments.
   * @returns {void}
   */
  info(supplier, ...args) {
    this[INFO_METHOD]('info', supplier, args)
  }

  /**
   * Log a debug message.
   * If the first argument is a function, it will be call with the others arguments if the level of logging supported.
   * By default debug level is inactive.
   * @param {StringSupplier|any} supplier String supplier or anythings.
   * @param {...any} args Optinals arguments.
   * @returns {void}
   */
  debug(func, ...args) {
    this[INFO_METHOD]('debug', func, args)
  }

  /**
   * Log HTTP message.
   * By default log level is active.
   * The log message is inspired by the default one of the http.server Python module.
   * @param {import('http').IncomingMessage} req HTTP request.
   * @param {import('http').ServerResponse} res HTTP response.
   * @returns {void}
   */
  log(req, res) {
    super.log('%s:%d [%s] "%s %s HTTP/%s" %d',
      req.socket.remoteAddress,
      req.socket.remotePort,
      this._dateTimeFormat.format(Date.now()),
      req.method,
      decodeURIComponent(req.url),
      req.httpVersion,
      res.statusCode,
    )
  }

  /**
   * Common method to debug and info levels.
   * @protected
   * @param {'info'|'debug'} level Requested level.
   * @param {StringSupplier|any} supplier String supplier or anythings.
   * @param {any[]} args Optionals arguments.
   * @returns {void}
   */
  [INFO_METHOD](level, supplier, args) {
    const method = super[level]
    if (typeof supplier === 'function') {
      const result = supplier.apply(undefined, args)
      if (Array.isArray(result)) {
        return result.forEach(r => method.apply(this, r))
      }
      return method(result)
    }
    method.call(this, supplier, ...args)
  }

  /**
   * Date time formatter.
   * @property
   * @protected
   * @readonly
   * @type {Intl.DateTimeFormat}
   */
  _dateTimeFormat
}
