import * as http from 'http'
import { defaultValues, toCamelCase } from '../util.mjs'

/**
 * @typedef HttpServerListenOptions
 * @property {string} host Host to listen.
 * @property {number} port Port to listen.
 */

/**
 * @typedef HttpServerOptions
 * @property {string[]} methods HTTP allowed methods.
 */

/**
 * Handle HTTP request.
 * @callback HttpMethodHandler
 * @param {http.IncomingMessage} req HTTP request.
 * @param {http.ServerResponse} res HTTP response.
 * @return {Promise<void>} Ignore the result.
 */

/**
 * Handler if the HTTP method is not allowed by the server.
 * @type {HttpMethodHandler}
 */
const NOT_ALLOWED_METHOD = async (req, res) => {
  res.writeHead(501)
}

export default class HttpServer {
  /**
   * Merge the given options with the defaults.
   * @param {HttpServerListenOptions} [options] Server listening options.
   * @returns The server listening options merged with the defaults.
   */
  static listenOptions(options) {
    return defaultValues([
      { key: 'host', d: '0.0.0.0' },
      { key: 'port', d: 3000 },
    ], options)
  }

  /**
   * Merge the given server options with the defaults.
   * @param {HttpServerOptions} [options] Server options.
   * @returns The server options merged with the default.
   */
  static serverOptions(options) {
    return defaultValues([
      { key: 'method', d: [] },
    ], options)
  }

  /**
   * HTTP Server.
   * @property
   * @public
   * @readonly
   * @type {http.Server}
   */
  server

  /**
   * Allowed HTTP methods.
   * @property
   * @public
   * @readonly
   * @type {readonly string[]}
   */
  methods

  /**
   * Create a new HTTP server.
   * @param {HttpServerListenOptions} [options] HTTP Server options.
   */
  constructor(options) {
    options = HttpServer.serverOptions(options)
    const methods = new Set(options.methods)
      .add('GET').add('HEAD')
    this._handlers = {}
    this.methods = []
    for (const method of http.METHODS) {
      if (methods.delete(method)) {
        this[toCamelCase(method)] = this.addHandler.bind(this, method)
        this._handlers[method] = []
        this.methods.push(method)
      } else {
        this._handlers[method] = [NOT_ALLOWED_METHOD]
      }
    }
    Object.freeze(this.methods)
    this.server = http.createServer(options.server, this._requestHandler.bind(this))
  }

  /**
   * Starts the HTTP server listening for connections. 
   * @param {HttpServerListenOptions} [options] Server listening options.
   * @returns {Promise<void>}
   */
  listen(options) {
    return new Promise((resolve, reject) => {
      this.server.prependOnceListener('error', reject)
      this.server.listen(HttpServer.listenOptions(options), () => {
        this.server.removeListener('error', reject)
        resolve()
      })
    })
  }

  /**
   * Add a handler to all allowed HTTP methods.
   * @param {HttpMethodHandler} handler The handler to add to all allowed HTTP methods.
   * @return {HttpServer} The current instance to chain the calls.
   */
  on(handler) {
    for (const method of this.methods) {
      this._handlers[method].push(handler)
    }
    return this
  }

  /**
   * Add handler to a HTTP method.
   * @param {string} method HTTP method.
   * @param {HttpMethodHandler} handler The handler to add to the HTTP method.
   * @returns {HttpServer} The current instance to chain the calls.
   */
  addHandler(method, handler) {
    this._handlers[method].push(handler)
    return this
  }

  /**
   * HTTP request handler.
   * Run one by one the asynchronous method handler.
   * Catch all errors and log them with the 'error' method of the global console.
   * End all responses by calling 'end' method.
   * @param {http.IncomingMessage} req The HTTP request.
   * @param {http.ServerResponse} res The HTTP response.
   * @returns {Promise<void>}
   */
  async _requestHandler(req, res) {
    try {
      for (const handler of this._handlers[req.method]) {
        await handler(req, res)
      }
    } catch (error) {
      console.error(error)
    } finally {
      res.end()
    }
  }

  /**
   * HTTP methods handlers.
   * @property
   * @protected
   * @readonly
   * @type {HttpMethodHandler[]}
   */
  _handlers
}
