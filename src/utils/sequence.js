var util = require('util');
var extend = require('extend');

function Sequence(config) {
  var _default = {
    onWarning: null,
    warningLimit: 300
  }
  _default = extend(_default, config);
  var self = this;
  this.sequence = [];
  this.counter = 1;
  this.name = config.name;

  setImmediate(function nextSequenceTick() {
    if (_default.onWarning && self.sequence.length >= _default.warningLimit) {
      _default.onWarning(self.sequence.length, _default.warningLimit);
    }
    self.__tick(function () {
      setTimeout(nextSequenceTick, 3);
    });
  });
}

Sequence.prototype.__tick = function (cb) {
  var self = this;
  var task = this.sequence.shift();
  if (!task) {
    return setImmediate(cb);
  }
  var args = [function (err, res) {
    // console.log(self.name + " sequence out " + task.counter + ' func ' + task.worker.name);
    task.done && setImmediate(task.done, err, res);
    setImmediate(cb);
  }];
  if (task.args) {
    args = args.concat(task.args);
  }
  task.worker.apply(task.worker, args);
}

Sequence.prototype.add = function (worker, args, done) {
  if (!done && args && typeof(args) == 'function') {
    done = args;
    args = undefined;
  }
  if (worker && typeof(worker) == 'function') {
    var task = {worker: worker, done: done};
    if (util.isArray(args)) {
      task.args = args;
    }
    task.counter = this.counter++;
    // console.log(this.name + " sequence in " + task.counter + ' func ' + worker.name);
    this.sequence.push(task);
  }
}

Sequence.prototype.count = function () {
  return this.sequence.length;
}

module.exports = Sequence;
