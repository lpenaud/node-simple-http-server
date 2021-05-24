import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import HttpRange from './http/http-range.mjs';
import { STAT_FILTER } from './util.mjs';

/**
 * @class
 * @name HttpMethodHandler
 * @param {object} options Contructor options.
 * @param {import('http').IncomingMessage} options.req HTTP request.
 * @param {import('../index.mjs').HeaderInfo} options.info
 */

/**
 * Prepare the response header.
 * @method
 * @name HttpMethodHandler#prepare
 * @param {import('http').ServerResponse} res HTTP response
 * @returns {void}
 */

/**
 * Send the response body.
 * @method
 * @name HttpMethodHandler#send
 * @param {import('http').IncomingMessage} req HTTP request.
 * @param {import('http').ServerResponse} res HTTP response.
 */

/**
 * @implements {HttpMethodHandler}
 */
export class FileHttpMethodHandler {
  constructor({ req, info }) {
    this._range = new HttpRange(info.stats, req)
    this._pathname = info.pathname
  }

  prepare(res) {
    if (this._range.size < 0 || this._range.end === 0) {
      res.writeHead(416)
      res.end()
      return
    }
    this._range.setHeader(res)
    res.setHeader('Content-Type', 'applications/octet-stream')
  }

  async send(req, res) {
    const readStream = createReadStream(this._pathname, {
      start: this._range.start,
      end: this._range.end,
    })
    try {
      await pipeline(readStream, res)
    } finally {
      readStream.destroy()
    }
  }

  _range
  _pathname
}

/**
 * @implements {HttpMethodHandler}
 */
export class DirectoryHttpMethodHandler {

  constructor({ info }) {
    this._pathname = info.pathname
  }

  prepare(res) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html')
  }

  async send(req, res) {
    const parsed = path.parse(this._pathname)
    const files = []
    if (parsed.base === '.') {
      parsed.base = '/'
    } else {
      files.push(`<li><a href="/${parsed.dir}">..</a></li>`)
    }
    files.push(...(await fs.readdir(this._pathname, { withFileTypes: true }))
      .filter(STAT_FILTER)
      .sort((f1, f2) => f1.name.localeCompare(f2.name))
      .map(f => `
<li>
  <a href="/${path.join(this._pathname, f.name)}">${f.name + (f.isDirectory() ? '/' : '')}</a>
</li>`)
    )
    const title = `Directory listing for ${parsed.base}`
    await new Promise((resolve) => {
      res.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
<head>
<body>
  <h1>${title}</h1>
  <hr>
  <ul>${files.join('')}</ul>
  <form action="" method="POST" enctype="multipart/form-data">
    <label for="infile">Choose a file</label>
    <input type="file" name="infile" onchange="event.target.parentElement.submit()" required multiple>
  </form>
  <hr>
</body>
</html>`, resolve)
    })
  }

  _pathname
}

/**
 * @implements {HttpMethodHandler}
 */
export class NotFoundHttpMethodHandler {
  prepare(res) {
    res.writeHead(404)
  }

  send() {
    return Promise.resolve()
  }
}
