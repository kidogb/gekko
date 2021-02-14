/*
	RSI Bull and Bear + ADX modifier
	1. Use different RSI-strategies depending on a longer trend
	2. But modify this slighly if shorter BULL/BEAR is detected
	-
	(CC-BY-SA 4.0) Tommie Hansen
	https://creativecommons.org/licenses/by-sa/4.0/
	-
	NOTE: Requires custom indicators found here:
	https://github.com/Gab0/Gekko-extra-indicators
	(c) Gabriel Araujo
	Howto: Download + add to gekko/strategies/indicators
*/

// req's
var log = require('../core/log.js');
var config = require('../core/util.js').getConfig();

// strategy
var strat = {

	/* INIT */
	init: function () {
		// core
		this.name = 'EMA Cross Trailing short';
		this.requiredHistory = config.tradingAdvisor.historySize;
		this.resetTrend();

		// debug? set to false to disable all logging/messages/stats (improves performance in backtests)
		this.debug = false;

		// performance
		config.backtest.batchSize = 1000; // increase performance
		config.silent = true; // NOTE: You may want to set this to 'false' @ live
		config.debug = false;

		// SMA
		this.addIndicator('emaSlow', 'EMA', this.settings.EMA_long);
		this.addIndicator('emaFast', 'EMA', this.settings.EMA_short);

		this.prev_price = undefined;
		this.prev_emaFast = undefined;
		this.prev_emaSlow = undefined;
		this.entry_price = undefined;
		this.stop_price = undefined;
		this.max_draw_down = undefined;
		this.max_run_up = undefined;
		// debug stuff
		this.startTime = new Date();

		/* MESSAGES */

		// message the user about required history
		log.info("====================================");
		log.info('Running', this.name);
		log.info('====================================');
		log.info("Make sure your warmup period matches SMA_long and that Gekko downloads data if needed");

		// warn users
		if (this.requiredHistory < this.settings.SMA_long) {
			log.warn("*** WARNING *** Your Warmup period is lower then SMA_long. If Gekko does not download data automatically when running LIVE the strategy will default to BEAR-mode until it has enough data.");
		}

	}, // init()


	/* RESET TREND */
	resetTrend: function () {
		var trend = {
			duration: 0,
			direction: 'none',
			shortPos: false,
		};

		this.trend = trend;
	},


	/* CHECK */
	check: function (candle) {
		// get all indicators
		let ind = this.indicators,
			emaSlow = ind.emaSlow.result,
			emaFast = ind.emaFast.result,
			price = candle.close,
			prev_emaFast = this.prev_emaFast,
			prev_emaSlow = this.prev_emaSlow,
			prev_price = this.prev_price,
			entry_price = this.entry_price,
			stop_price = this.stop_price,
			trailing = this.settings.TRAILING,
			max_draw_down = this.max_draw_down,
			max_run_up = this.max_run_up;
		if (max_draw_down && max_draw_down <= price) this.max_draw_down = price;
		if (max_run_up && max_run_up >= price) this.max_run_up = price;
		const short_cond = prev_emaFast >= prev_emaSlow && emaFast < emaSlow && price < emaSlow;
		const long_cond = emaFast > emaSlow && price > emaSlow;
		// if (this.entry_price && this.entry_price < candle.close && (1-this.entry_price/candle.close) >= this.settings.DD/100) this.short(candle)
		if (entry_price && price >= stop_price) {
			console.log("Stop short: ", candle.close);
			this.long(candle);
		}
		if (entry_price && entry_price > price) {
			let tp = entry_price * (1 - this.settings.TP / 100);
			if (price <= tp) {
				this.stop_price = ((this.max_run_up - entry_price) * trailing + entry_price);
				// console.log("Trailing: ", entry_price, stop_price, price);
			} else {
				this.stop_price = entry_price * (1 + this.settings.DD / 100);
			}
		} else {
			this.stop_price = entry_price ? entry_price * (1 + this.settings.DD / 100) : undefined;
		}

		if (short_cond) this.short(candle);
		if (long_cond) this.long(candle);

		this.prev_emaFast = emaFast;
		this.prev_emaSlow = emaSlow;
		this.prev_price = candle.close;

	}, // check()


	/* LONG */
	long: function (candle) {
		if (this.trend.direction !== 'up') // new trend? (only act on new trends)
		{
			this.resetTrend();
			this.trend.direction = 'up';
			console.log("Long: ", candle.close);
			console.log("Max DD: ", this.max_draw_down);
			console.log("Max run up: ", this.max_run_up);
			console.log("Trailing: ", this.stop_price);
			// console.log("\n-------------------------------------------");
			this.max_draw_down = undefined;
			this.max_run_up = undefined;
			this.stop_price = undefined;
			this.entry_price = undefined;
			this.advice('long');
			if (this.debug) log.info('Going long');
		}

		if (this.debug) {
			this.trend.duration++;
			log.info('Long since', this.trend.duration, 'candle(s)');
		}
	},


	/* SHORT */
	short: function (candle) {
		// new trend? (else do things)
		if (this.trend.direction !== 'down') {
			this.resetTrend();
			this.trend.direction = 'down';
			this.entry_price = candle.close;
			this.max_draw_down = candle.close;
			this.max_run_up = candle.close;
			console.log("Short: ", candle.close);
			this.advice('short');
			if (this.debug) log.info('Going short');
		}

		if (this.debug) {
			this.trend.duration++;
			log.info('Short since', this.trend.duration, 'candle(s)');
		}
	},


	/* END backtest */
	end: function () {
		let seconds = ((new Date() - this.startTime) / 1000),
			minutes = seconds / 60,
			str;

		minutes < 1 ? str = seconds.toFixed(2) + ' seconds' : str = minutes.toFixed(2) + ' minutes';

		log.info('====================================');
		log.info('Finished in ' + str);
		log.info('====================================');

	}

};

module.exports = strat;