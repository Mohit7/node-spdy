var protocol = exports;

//
// ### function parseSynHead (type, flags, data)
// #### @type {Number} Frame type
// #### @flags {Number} Frame flags
// #### @data {Buffer} input data
// Returns parsed syn_* frame's head
//
protocol.parseSynHead = function parseSynHead(type, flags, data, callback) {
  var stream = type === 0x01;

  if (data.length < (stream ? 10 : 4)) {
    return callback(new Error('SynHead OOB'));
  }

  callback(null, {
    type: stream ? 'SYN_STREAM' : 'SYN_REPLY',
    id: data.readUInt32BE(0, true) & 0x7fffffff,
    version: 3,
    associated: stream ? data.readUInt32BE(4, true) & 0x7fffffff : 0,
    priority: stream ? data[8] >> 5 : 0,
    fin: (flags & 0x01) === 0x01,
    unidir: (flags & 0x02) === 0x02,
    _offset: stream ? 10 : 4
  });
};

//
// ### function parseHeaders (pairs)
// #### @pairs {Buffer} header pairs
// Returns hashmap of parsed headers
//
protocol.parseHeaders = function parseHeaders(pairs, callback) {
  var count = pairs.readUInt32BE(0, true),
      headers = {};

  pairs = pairs.slice(4);

  function readString() {
    if (pairs.length < 4) {
      return null;
    }
    var len = pairs.readUInt32BE(0, true);

    if (pairs.length < 4 + len) {
      return null;
    }
    var value = pairs.slice(4, 4 + len);

    pairs = pairs.slice(4 + len);

    return value.toString();
  }

  while(count > 0) {
    var key = readString(),
        value = readString();
    if (key === null || value === null) {
      return callback(new Error('Headers OOB'));
    }
    headers[key.replace(/^:/, '')] = value;
    count--;
  }

  callback(null, headers);
};

//
// ### function parsesRst frame
protocol.parseRst = function parseRst(data, callback) {
  if (data.length < 8) return callback(new Error('RST OOB'));

  callback(null, {
    type: 'RST_STREAM',
    id: data.readUInt32BE(0, true) & 0x7fffffff,
    status: data.readUInt32BE(4, true)
  });
};

protocol.parseSettings = function parseSettings(data, callback) {
  if (data.length < 4) return callback(new Error('SETTINGS OOB'));

  var settings = {},
      number = data.readUInt32BE(0, true),
      idMap = {
        1: 'upload_bandwidth',
        2: 'download_bandwidth',
        3: 'round_trip_time',
        4: 'max_concurrent_streams',
        5: 'current_cwnd',
        6: 'download_retrans_rate',
        7: 'initial_window_size',
        8: 'client_certificate_vector_size'
      };

  if (data.length < 4 + number * 8) {
    return callback(new Error('SETTINGS OOB#2'));
  }

  for (var i = 0; i < number; i++) {
    var id = data.readUInt32BE(4 + (i*8), true) & 0x00ffffff,
        flags = data.readUInt8(4 + (i*8), true),
        name = idMap[id];
    settings[id] = settings[name] = {
      persist: !!(flags & 0x1),
      persisted: !!(flags & 0x2),
      value: data.readUInt32BE(8 + (i*8), true)
    };
  }

  callback(null, {
    type: 'SETTINGS',
    settings: settings
  });
};

protocol.parseGoaway = function parseGoaway(data, callback) {
  if (data.length < 4) return callback(new Error('GOAWAY OOB'));

  callback(null, {
    type: 'GOAWAY',
    lastId: data.readUInt32BE(0, true) & 0x7fffffff
  });
};

protocol.parseWindowUpdate = function parseWindowUpdate(data, callback) {
  if (data.length < 8) return callback(new Error('WINDOW_UPDATE OOB'));

  callback(null, {
    type: 'WINDOW_UPDATE',
    id: data.readUInt32BE(0, true) & 0x7fffffff,
    delta: data.readUInt32BE(4, true) & 0x7fffffff
  });
};
