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
const export_csv = (rows) =>{
	// const rows = [
	// 	["name1", "city1", "some other info"],
	// 	["name2", "city2", "more info"]
	// ];
	
	let csvContent = "data:text/csv;charset=utf-8," 
		+ rows.map(e => e.join(",")).join("\n");

	var encodedUri = encodeURI(csvContent);
		window.open(encodedUri);
}
// strategy
var strat = {

	/* INIT */
	init: function () {
		// core
		this.name = 'EMA Cross';
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
		// ADX
		this.addIndicator('ADX', 'ADX', this.settings.ADX.adx );

		this.prev_price = undefined;
		this.prev_emaFast = undefined;
		this.prev_emaSlow = undefined;
		this.entry_price = undefined;
		this.stop_price = undefined;
		this.max_draw_down = undefined;
		this.max_run_up = undefined;
		
		// debug stuff
		this.startTime = new Date();

		// add min/max if debug
		if (this.debug) {
			this.stat = {
				adx: { min: 1000, max: 0 },
				bear: { min: 1000, max: 0 },
				bull: { min: 1000, max: 0 }
			};
		}

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
			longPos: false,
		};

		this.trend = trend;
	},


	/* get low/high for backtest-period */
	lowHigh: function (val, type) {
		let cur;
		if (type == 'bear') {
			cur = this.stat.bear;
			if (val < cur.min) this.stat.bear.min = val; // set new
			else if (val > cur.max) this.stat.bear.max = val;
		}
		else if (type == 'bull') {
			cur = this.stat.bull;
			if (val < cur.min) this.stat.bull.min = val; // set new
			else if (val > cur.max) this.stat.bull.max = val;
		}
		else {
			cur = this.stat.adx;
			if (val < cur.min) this.stat.adx.min = val; // set new
			else if (val > cur.max) this.stat.adx.max = val;
		}
	},


	/* CHECK */
	check: function (candle) {
		// get all indicators
		let ind = this.indicators,
			emaSlow = ind.emaSlow.result,
			emaFast = ind.emaFast.result,
			adx = ind.ADX.result,
			price = candle.close,
			prev_emaFast = this.prev_emaFast,
			prev_emaSlow = this.prev_emaSlow,
			prev_price = this.prev_price,
			entry_price = this.entry_price,
			stop_price = this.stop_price,
			trailing = this.settings.TRAILING,
			max_draw_down = this.max_draw_down,
			max_run_up = this.max_run_up;
		if (max_draw_down && max_draw_down >= price) this.max_draw_down = price;
		if (max_run_up && max_run_up <= price) this.max_run_up = price;
		// const long_cond = emaFast > emaSlow && candle.close > emaFast && candle.close > emaSlow && !(this.prev_price > this.prev_emaFast && this.prev_price > this.emaSlow);
		// const short_cond = candle.close < emaSlow;
		const long_cond = prev_emaFast <= prev_emaSlow && emaFast > emaSlow && price > emaSlow;
		const short_cond = emaFast < emaSlow && price < emaSlow;
		const is_sideway_market = adx <= this.settings.ADX.threshold;
		// if (this.entry_price && this.entry_price < candle.close && (1-this.entry_price/candle.close) >= this.settings.DD/100) this.short(candle)
		if (entry_price && price <= stop_price) {
			// console.log("Stop: ", candle.close);
			this.short(candle);
		}
		if (entry_price && entry_price < price) {
			let tp = entry_price * (1 + this.settings.TP / 100);
			if (price >= tp) {
				this.stop_price = ((this.max_run_up - entry_price) * trailing + entry_price);
				// console.log("Trailing: ", entry_price, stop_price, price);
			} else {
				this.stop_price = entry_price * (1 - this.settings.DD / 100);
			}
		} else {
			this.stop_price = entry_price ? entry_price * (1 - this.settings.DD / 100) : undefined;
		}

		if (long_cond && !is_sideway_market) this.long(candle);
		if (short_cond) this.short(candle);

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
			this.entry_price = candle.close;
			this.max_draw_down = candle.close;
			this.max_run_up = candle.close;
			// console.log("Long: ", candle.close);
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
			this.entry_price = undefined;
			// console.log("Short: ", candle.close);
			// console.log("Max DD: ", this.max_draw_down);
			// console.log("Max run up: ", this.max_run_up);
			// console.log("Trailing: ", this.stop_price);
			this.max_draw_down = undefined;
			this.max_run_up = undefined;
			this.stop_price = undefined;
			// console.log("\n-------------------------------------------");
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

		// print stats and messages if debug
		if (this.debug) {
			let stat = this.stat;
			log.info('BEAR RSI low/high: ' + stat.bear.min + ' / ' + stat.bear.max);
			log.info('BULL RSI low/high: ' + stat.bull.min + ' / ' + stat.bull.max);
			log.info('ADX min/max: ' + stat.adx.min + ' / ' + stat.adx.max);
		}

	}

};

module.exports = strat;