import fs from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import { fileURLToPath } from 'url'
import {
  DirectoryHttpMethodHandler,
  NotFoundHttpMethodHandler,
  FileHttpMethodHandler 
} from './src/handlers.mjs'
import HttpServer from './src/http/http-server.mjs'
import HttpForm from './src/http/http-form.mjs'
import HttpLogger from './src/http/http-logger.mjs'
import { moveFile, STAT_FILTER } from './src/util.mjs'

/**
 * @typedef HeaderInfo
 * @property {string} pathname Relative path to the file.
 * @property {import('fs').Stats|null} stats Files stats or null if pathname represent a regular file or a directory.
 */

/**
 * @typedef ConfigArgs
 * @property {object} listen Server listening options.
 * @property {string} [listen.host] Server host.
 * @property {number} [listen.port] Server port.
 * @property {object} log Logging options.
 * @property {number} [log.level] Logging level.
 */

/**
 * Try to get file stat.
 * This function works only with the regular files and the directories.
 * @param {string} pathname File pathname.
 * @returns {Promise<import('fs').Stats|null>} If file exists return its stats, otherwise null.
 */
async function tryStats(pathname) {
  try {
    const stat = await fs.stat(pathname)
    return STAT_FILTER(stat) ? stat : null
  } catch (error) {
    return null
  }
}

/**
 * Print usage and exit.
 * @param {number} code Exit code
 * @returns {void}
 * @see {@link Process#exit}
 */
function usage(code) {
  const printer = code === 0 ? console.log : console.error
  const httpOptions = HttpServer.listenOptions()
  const loggerOptions = HttpLogger.getOptions()
  const prgm = path.basename(process.argv[1])
  const formatter = arg => printer(`  ${prgm} ${arg}`)
  printer('Usage:')
  formatter(`[(-H --host) HOST=${httpOptions.host}]`)
  formatter(`[(-p --port) PORT=${httpOptions.port}]`)
  formatter(`[(-l --level) LEVEL=${loggerOptions.level}]`)
  formatter('(-h --help)')
  process.exit(code)
}

/**
 * Read command line arguments.
 * @param {string[]} args Command line arguments.
 * @returns {ConfigArgs} Parsed arguments.
 */
function readArgs(args) {
  const config = {
    listen: {},
    log: {},
  }
  let hasError = false
  let arg
  while (args.length > 0) {
    switch (arg = args.shift()) {
      case '--port':
      case '-p':
        const port = parseInt(args.shift())
        if (port === NaN || port < 0 || port >= 65536) {
          console.error('PORT should be >= 0 and < 65536')
          hasError = true
        } else {
          config.listen.port = port
        }
        break

      case '--host':
      case '-H':
        config.listen.host = args.shift()
        break

      case '-l':
      case '--level':
        const level = args.shift()
        if (typeof HttpLogger.LEVELS[level] !== 'number') {
          console.error('Undefined log level', level)
          hasError = true
        } else {
          config.log.level = HttpLogger.LEVELS[level]
        }
        break

      case '-h':
      case '--help':
        usage(console.log, 0)
        break

      default:
        console.error(`Invalid arg: ${arg}`)
        hasError = true
        break
    }
  }
  if (hasError) {
    usage(console.error, 1)
  }
  return config
}

/**
 * Initialise the simple http server.
 * @param {string[]} args Command line arguments.
 */
async function main(args) {
  args = readArgs(args)
  const infoSymbol = Symbol('info')
  const server = new HttpServer({
    methods: ['POST', 'PUT'],
  })
  const logger = new HttpLogger(args.log)
  const headHandler = (req, res) => {
    const info = req[infoSymbol]
    const args = { res, req, info }
    const handler = info.stats === null ? new NotFoundHttpMethodHandler(args)
      : info.stats.isDirectory() ? new DirectoryHttpMethodHandler(args)
        : info.stats.isFile() ? new FileHttpMethodHandler(args)
          : new NotFoundHttpMethodHandler(args)
    handler.prepare(res)
    return handler
  }
  const reveiveFile = async (res, req, form, pathname, method) => {
    const files = form.files.map(f => ({ path: f.path, pathname: path.join(pathname, f.filename) }))
    try {
      await Promise.all(files.map(f => moveFile(f.path, f.pathname)))
      logger.info(() => files.map(f => ['%s %s', method, f.pathname]))
    } catch (error) {
      res.statusCode = 500
      logger.error(error)
    } finally {
      await Promise.all(files.map(f => fs.rm(f.path, { force: true })))
    }
    res.writeHead(303, {
      'location': req.url,
    })
    res.end()
  }
  server.on(async (req, res) => {
    const pathname = path.join('.', decodeURIComponent(req.url))
    req[infoSymbol] = {
      pathname,
      stats: await tryStats(pathname),
    }
  })
    .head((req, res) => headHandler(req, res))
    .get((req, res) => headHandler(req, res).send(req, res))
    .post(async (req, res) => {
      const { pathname, stat } = req[infoSymbol]
      if (stat === null) {
        res.statusCode = 404
        return
      }
      const form = new HttpForm(req.headers['content-type'])
      await pipeline(req, form)
      const files = new Set(form.files.map(f => f.filename))
      const existingFiles = (await fs.readdir(pathname)).filter(f => files.delete(f))
      if (existingFiles.length > 0) {
        res.statusCode = 418
        await Promise.all(form.files.map(f => fs.rm(f.path, { force: true })))
      } else {
        await reveiveFile(res, req, form, pathname, req.method)
      }
    })
    .put(async (req, res) => {
      const { pathname, stat } = req[infoSymbol]
      if (stat === null) {
        res.statusCode = 404
        return
      }
      const form = new HttpForm(req.headers['content-type'])
      await pipeline(req, form)
      await reveiveFile(res, req, form, pathname, req.method)
    })
    .on(logger.log)
  await server.listen(args.listen)
  console.log('Web server listening on http://%s:%d', args.listen.host, args.listen.port)
}

// Did the user call me in the first place?
if (fileURLToPath(import.meta.url).startsWith(process.argv[1])) {
  main(process.argv.slice(2))
}
