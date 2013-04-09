var url = require('url')
,   fs = require('fs')
,   util = require('util')

function Canned(dir, options){
  this.logger = options.logger
  this.dir = process.cwd() + '/' + dir
}

function scanFileListForName(files, pattern){
  var m, i, e
  for (i = 0, e = files[i]; e != null; e = files[++i]) {
    m = e.match(new RegExp(pattern))
    if(m) return m
  }
  return false
}

// return a data structure representing the response for a file
// datastructure mirrors Racks [headers, status, content]
// while headers are [[name, value], [name, value]]
Canned.prototype._responseForFile = function(fname, path, method, files, cb){
  var pattern = fname + '\.' + method + '\.(.+)'
  ,   that = this
  ,   m

  if(m = scanFileListForName(files, pattern)){
    var file = path + '/' + m[0]
    fs.readFile(file, { encoding: 'utf8' }, function(err, data){
      if(err) {
        cb('Not found', [[['Content-Type', 'text/html']], 400, ''])
      } else {
        cb(null, [[['Content-Type', 'application/' + m[1]]], 200, data])
      }
    })
  } else {
    cb('Not found', [[['Content-Type', 'text/html']], 400, ''])
  }
}

function writeError(res){
  writeResponse(res, [[['Content-Type', 'text/html']], 400, ''])
}

function writeResponse(res, resp){
  for(var i = 0, h = resp[0][i]; h != null; h = resp[0][++i]){
    res.setHeader(h[0], h[1])
  }
  res.statusCode = resp[1]
  res.end(resp[2])
}

Canned.prototype._log = function(message){
  if(this.logger) this.logger.write(message)
}

Canned.prototype.responder = function(req, res){
  var pathname = req.url.split('/')
  ,   dname = pathname.pop()
  ,   fname = '_' + dname
  ,   method = req.method.toLowerCase()
  ,   path = this.dir + pathname.join('/')
  ,   that = this

  this._log('request: ' + req.method + ' ' + req.url)

  fs.readdir(path, function(err, files){
    fs.stat(path + '/' + dname, function(err, stats){
      if(err){
        that._responseForFile(fname, path, method, files, function(err, resp){
          if(err) {
            that._responseForFile('any', path, method, files, function(err, resp){
              if(err) {
                that._log(' not found\n')
              } else {
                that._log(' served via: ' + pathname.join('/') + '/any.' + method + '\n')
              }
              writeResponse(res, resp)
            })
          } else {
            that._log(' served via: ' + pathname.join('/') + '/' + fname + '.' + method + '\n')
            writeResponse(res, resp)
          }
        })
      } else {
        if(stats.isDirectory()) {
          var fpath = path + '/' + dname
          fs.readdir(fpath, function(err, files){
            that._responseForFile('index', fpath, method, files, function(err, resp){
              if(err) {
                that._log(' not found\n')
              } else {
                that._log(' served via: ' + pathname.concat(dname).join('/') + '/index.' + method + '\n')
              }
              writeResponse(res, resp)
            })
          })
        } else {
          writeError(res)
        }
      }
    })
  })
}

var canned = function(dir, options){
  if(!options) options = {}
  c = new Canned(dir, options)
  return c.responder.bind(c)
}

module.exports = canned
