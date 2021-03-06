const { clonePlainObject } = require('../util')
const XMLHttpRequest = require('xhr2')
const jsonp = require('jsonp')

const ERROR_STATE = -1

const TYPE_JSON = 'application/json;charset=UTF-8'
const TYPE_FORM = 'application/x-www-form-urlencoded'

const REG_FORM = /^(?:[^&=]+=[^&=]+)(?:&[^&=]+=[^&=]+)*$/

const DEFAULT_METHOD = 'GET'
const DEFAULT_MODE = 'cors'
const DEFAULT_TYPE = 'text'

const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH']
const modeOptions = ['cors', 'no-cors', 'same-origin', 'navigate']
const typeOptions = ['text', 'json', 'jsonp', 'arraybuffer']

/**
 * fetch
 * use stream.fetch to request for a json file, a plain text file or
 * a arraybuffer for a file stream. (You can use Blob and FileReader
 * API implemented by most modern browsers to read a arraybuffer.)
 * @param  {object} options config options
 *   - method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH'
 *   - headers {obj}
 *   - url {string}
 *   - mode {string} 'cors' | 'no-cors' | 'same-origin' | 'navigate'
 *   - body
 *   - type {string} 'json' | 'jsonp' | 'text'
 * @param  {string} callbackId
 * @param  {string} progressCallbackId
 */
function _fetch (instance, document, options, callbackId, progressCallbackId) {
  const config = clonePlainObject(options)

  // validate options.method
  if (typeof config.method === 'undefined') {
    config.method = DEFAULT_METHOD
  }
  else if (methodOptions.indexOf((config.method + '')
      .toUpperCase()) === -1) {
    return console.error(`[stream] options.method "${config.method}" for "fetch" API should be one of ${methodOptions}.`)
  }

  // validate options.url
  if (!config.url) {
    return console.error(`[stream] options.url should be set for "fetch" API.`)
  }

  // validate options.mode
  if (typeof config.mode === 'undefined') {
    config.mode = DEFAULT_MODE
  }
  else if (modeOptions.indexOf((config.mode + '').toLowerCase()) === -1) {
    return console.error(`[stream] options.mode "${config.mode}" for "fetch" API should be one of ${modeOptions}.`)
  }

  // validate options.type
  if (typeof config.type === 'undefined') {
    config.type = DEFAULT_TYPE
  }
  else if (typeOptions.indexOf((config.type + '').toLowerCase()) === -1) {
    return console.error(`[stream] options.type "${config.type}" for "fetch" API should be one of ${typeOptions}.`)
  }

  // validate options.headers
  config.headers = config.headers || {}
  if (!config.headers) {
    return console.error(`[stream] options.headers should be a plain object.`)
  }

  // validate options.body
  const body = config.body
  if (!config.headers['Content-Type'] && body) {
    if (body) {
      // is a json data
      try {
        config.body = JSON.stringify(body)
        config.headers['Content-Type'] = TYPE_JSON
      }
      catch (e) {}
    }
    else if (typeof body === 'string' && body.match(REG_FORM)) {
      // is form-data
      config.body = encodeURI(body)
      config.headers['Content-Type'] = TYPE_FORM
    }
  }

  // validate options.timeout
  config.timeout = parseInt(config.timeout, 10) || 2500

  const _callArgs = [config, function (res) {
    instance.$callback(callbackId, res, false)
  }]
  if (progressCallbackId) {
    _callArgs.push(function (res) {
      // Set 'keepAlive' to true for sending continuous callbacks
      instance.$callback(progressCallbackId, res, true)
    })
  }

  if (config.type === 'jsonp') {
    _jsonp.apply(this, _callArgs)
  }
  else {
    _xhr.apply(this, _callArgs)
  }
}

function _jsonp (config, callback, progressCallback) {
  if (!config.url) {
    console.error(`[stream] config.url should be set in _jsonp for "fetch" API.`)
  }
  jsonp(config.url, {}, callback)
}

function _xhr (config, callback, progressCallback) {
  const xhr = new XMLHttpRequest()
  xhr.responseType = config.type
  xhr.open(config.method, config.url, true)

  const headers = config.headers || {}
  for (const k in headers) {
    xhr.setRequestHeader(k, headers[k])
  }

  xhr.onload = function (res) {
    callback({
      status: xhr.status,
      ok: xhr.status >= 200 && xhr.status < 300,
      statusText: xhr.statusText,
      data: xhr.response,
      headers: xhr.getAllResponseHeaders().split('\n')
        .reduce(function (obj, headerStr) {
          const headerArr = headerStr.match(/(.+): (.+)/)
          if (headerArr) {
            obj[headerArr[1]] = headerArr[2]
          }
          return obj
        }, {})
    })
  }

  if (progressCallback) {
    xhr.onprogress = function (e) {
      progressCallback({
        readyState: xhr.readyState,
        status: xhr.status,
        length: e.loaded,
        total: e.total,
        statusText: xhr.statusText,
        headers: xhr.getAllResponseHeaders().split('\n')
          .reduce(function (obj, headerStr) {
            const headerArr = headerStr.match(/(.+): (.+)/)
            if (headerArr) {
              obj[headerArr[1]] = headerArr[2]
            }
            return obj
          }, {})
      })
    }
  }

  xhr.onerror = function (err) {
    console.error(`[stream] unexpected error in _xhr for "fetch" API`, err)
    callback({
      status: ERROR_STATE,
      ok: false,
      statusText: '',
      data: '',
      headers: {}
    })
  }

  xhr.send(config.body)
}

exports.fetch = _fetch
