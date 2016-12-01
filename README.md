# umai-live-config

[![Build Status](https://travis-ci.org/abd2561024/umai-config-live.svg?branch=master)](https://travis-ci.org/abd2561024/umai-config-live) [![GitHub license](https://img.shields.io/badge/license-ISC-blue.svg)](https://raw.githubusercontent.com/technicallyjosh/node-config-live/master/LICENSE)

# Introduction

###Based on [node-config-live](https://github.com/technicallyjosh/node-config-live) by [Josh Newman](https://github.com/technicallyjosh)
Umai-live-config is a lite version [node-config-live](https://github.com/technicallyjosh/node-config-live) and adapted for Node.JS 0.10. It allows you to stored, live-updated configurations for your Node.js applications.

## Example Usage

Using the module.

```js
var config = require('config'); 
var ConfigLive = require('umai-config-config');
var liveConfig = new LiveConfig('localhost', 6379);

liveConfig.start(config);

liveConfig.on('error', function(err) {
    // Handle error
});

liveConfig.on('started', function(cfg) {
    // Config are ready for use
});

// single key set
liveConfig.set('mykey', 'myvalue');

// or you can set value and insure that entry was inserted
liveConfig.set('my-host', 'http://some-host')
    .then(function(result) {
        console.log(config['my-host']); // --> `http://some-host`
        console.log(result); // --> `{ key: 'my-host', value: 'http://some-host' }`
    });
 
```

## Tests
Just run:
```js
npm test
```

**TODO:**
* Create `set` for nested object
* More tests
