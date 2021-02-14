/*

  RSI - cykedev 14/02/2014

  (updated a couple of times since, check git history)

 */
// helpers
var _ = require('lodash');
var log = require('../core/log.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
  this.name = 'TE';

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.shouldBuy = false;
  this.shouldSell = false;
}


method.check = function() {

  if(!this.shouldBuy) {

    this.advice('long');
    this.shouldBuy = true;
    this.shouldSell = false;

  } else {
    this.advice('short');
    this.shouldSell = true;
    this.shouldBuy = false;
  }
}

module.exports = method;
