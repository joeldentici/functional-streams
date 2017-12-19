/**
 *	FunctionalStreams
 *	written by Joel Dentici
 *	on 12/18/2017
 *
 *	Functional event stream library.
 */

(function() {
	function Stream(thunk, scheduler) {
		this.thunk = thunk;
		this.schedule = scheduler || Stream.defaultScheduler;
	}

	/**
	 *	Scheduler :: (() -> ()) -> ()
	 *
	 *	Defers execution of a thunk.
	 */

	/**
	 *	Computation a :: ((a -> b), (() -> c))
	 *
	 *	A stream computation. We can either provide a
	 *	value by applying the first continuation, or
	 *	signal completion by applying the second continuation.
	 */

/** Constructors **/

	/**
	 *	create :: (Computation a -> (), Scheduler) -> Stream a
	 *
	 *	Creates a new Stream from a stream computation that
	 *	will be evaluated using the specified scheduler.
	 */
	Stream.create = function(thunk, scheduler) {
		return new Stream(thunk, scheduler);
	}

	/**
	 *	empty :: () -> Stream ()
	 *
	 *	Creates a new Stream that ends without
	 *	producing a value.
	 */
	Stream.empty = function() {
		return Stream.create(function(n, e) {
			e();

			return function dispose() {
				
			}
		});
	}

	/**
	 *	never :: () -> Stream ()
	 *
	 *	Creates a new Stream that never ends
	 *	and never produces a value.
	 */
	Stream.never = function() {
		return Stream.create(function() {
			return function dispose() {

			}
		});
	}

	/**
	 *	of :: a -> Stream a
	 *
	 *	Creates a new Stream that produces a
	 *	single value (the specified one) and
	 *	then ends.
	 */
	Stream.of = function(v) {
		return Stream.create(function(n, e) {
			n(v);
			e();

			return function dispose() {

			}
		});
	}

	/**
	 *	fromList :: [a] -> Stream a
	 *
	 *	Creates a Stream that produces in order
	 *	each value from the specified list, then
	 *	ends.
	 */
	Stream.fromList = function(vs) {
		return Stream.create(function(n, e) {
			vs.forEach(function(v) {
				n(v);
			});
			e();

			return function dispose() {

			}
		});
	}

/** Algebraic structures **/

	/**
	 *	chain :: Stream a -> (a -> Stream b) -> Stream b
	 *
	 *	Monadic composition. Each value produced by
	 *	this stream is used to create a new stream, which
	 *	is used to produce the values of the resulting stream.
	 *
	 *	This has 'switch' semantics to match with the Applicative
	 *	instance.
	 */
	Stream.prototype.chain = function(f) {
		return this.map(f).join();
	}

	/**
	 *	concatMap :: Stream a -> (a -> Stream b) -> Stream b
	 *
	 *	Monadic composition. Each value produced by
	 *	this stream is used to create a new stream, which
	 *	is used to produce the values of the resulting stream.
	 *
	 *	This has 'concat' semantics.
	 */
	Stream.prototype.concatMap = function(f) {
		return this.map(f).concat();
	}

	/**
	 *	mergeMap :: Stream a -> (a -> Stream b) -> Stream b
	 *
	 *	Monadic composition. Each value produced by
	 *	this stream is used to create a new stream, which
	 *	is used to produce the values of the resulting stream.
	 *
	 *	This has 'merge' semantics.
	 */
	Stream.prototype.mergeMap = function(f) {
		return this.map(f).merge();
	}

	/**
	 *	map :: Stream a -> (a -> b) -> Stream b
	 *
	 *	Functor mapping. The specified function is
	 *	applied to each value produced by this stream
	 *	to create the values produced by the resulting
	 *	stream.
	 */
	Stream.prototype.map = function(f) {
		var self = this;

		return Stream.create(function(n, e) {
			return self.fork(function(v) {
				n(f(v))
			}, e);
		}, this.schedule);
	}

	/**
	 *	join :: Stream (Stream a) -> Stream a
	 *
	 *	Flattens a Stream of Streams by one
	 *	level. This has switch semantics.
	 */
	Stream.prototype.join = function() {
		var self = this;

		return Stream.create(function(n, e) {
			var latest, outEnded;

			function innerEnd() {
				if (outEnded)
					e();
			}

			function outerEnd() {
				outEnded = true;
			}

			var disp = self.fork(
				function(v) {
					if (latest)
						latest();

					latest = v.fork(n, innerEnd);
				},
				outerEnd
			);

			return function dispose() {
				disp();
				if (latest)
					latest();
			}
		}, this.schedule);
	}

	/**
	 *	concat :: Stream (Stream a) -> Stream a
	 *
	 *	Flattens a Stream of Streams by one
	 *	level. This has concatenation semantics.
	 */
	Stream.prototype.concat = function() {
		var self = this;

		return Stream.create(function(n, e) {
			var latest, pending = [], outEnded, running, disped = false;

			function innerEnd() {
				running = false;
				runNext();

				if (outEnded && !running && !disped) {
					e();
				}
			}

			function outerEnd() {
				outEnded = true;
			}

			function runNext() {
				if (!running && pending.length && !disped) {
					running = true;
					var v = pending.pop();

					latest = v.fork(n, innerEnd);
				}
			}

			var disp = self.fork(
				function(v) {
					pending.push(v);
					runNext();
				},
				outerEnd
			);

			return function dispose() {
				disp();
				if (latest)
					latest();

				disped = true;
			}
		}, this.schedule);
	}

	/**
	 *	merge :: Stream (Stream a) -> Stream a
	 *
	 *	Flattens a Stream of Streams by one
	 *	level. This has merge semantics.
	 */
	Stream.prototype.merge = function() {
		var self = this;

		return Stream.create(function(n, e) {
			var forks = [], outEnded, innerEnded = 0;

			function innerEnd() {
				innerEnded++;
				if (outEnded && forks.length === innerEnded)
					e();
			}

			function outerEnd() {
				outEnded = true;
			}

			var disp = self.fork(
				function(v) {
					forks.push(v.fork(n, innerEnd));
				},
				outerEnd
			);

			return function dispose() {
				disp();
				forks.forEach(T());
			}
		}, this.schedule);
	}

	/**
	 *	app :: Stream (a -> b) -> Stream a -> Stream b
	 *
	 *	Applicative sequential application. Applies the latest
	 *	function in this Stream to the latest value in the specified
	 *	Stream to produce the values of the result Stream.
	 *
	 *	This Stream and the value Stream are evaluated concurrently.
	 */
	Stream.prototype.app = function(o) {
		var self = this;

		return Stream.create(function(n, e) {
			var func, val, fc = false, vc = false,
			fe = false, ve = false;

			var dispThis = self.fork(function(f) {
				func = f;
				fc = true;
				run();
			}, function() {
				fe = true;
				end();
			});

			var dispVal = o.fork(function(v) {
				val = v;
				vc = true;
				run();
			}, function() {
				ve = true;
				end();
			});

			function end() {
				if (fe && ve)
					e();
			}

			function run() {
				if (fc && vc) {
					n(func(val));
				}
			}

			return function dispose() {
				dispThis();
				dispVal();
			}
		}, this.schedule)
	}

	/**
	 *	seqL :: Stream a -> Stream b -> Stream a
	 *
	 *	Evaluates both this stream and the specified
	 *	stream, producing the latest value of this Stream
	 *	every time either Stream produces a value, after
	 *	each has produced at least one value.
	 */
	Stream.prototype.seqL = function(o) {
		return Stream.of(fst).app(this).app(o);
	}

	/**
	 *	seqR :: Stream a -> Stream b -> Stream b
	 *
	 *	Evaluates both this stream and the specified
	 *	stream, producing the latest value of that Stream
	 *	every time either Stream produces a value, after
	 *	each has produced at least one value.
	 */
	Stream.prototype.seqR = function(o) {
		return Stream.of(snd).app(this).app(o);
	}


/** Built in operators **/

	/**
	 *	filter :: Stream a -> (a -> bool) -> Stream a
	 *
	 *	Creates a stream that produces the values produced
	 *	by this stream that also satisfy the specified
	 *	predicate.
	 */
	Stream.prototype.filter = function(p) {
		var self = this;

		return Stream.create(function(n, e) {
			return self.fork(
				function(v) {
					if (p(v)) {
						n(v);
					}
				},
				e
			);
		}, this.schedule);
	}

	/**
	 *	start :: Stream a -> a -> Stream a
	 *
	 *	Creates a Stream that produces the
	 *	same values as this Stream, but starts
	 *	with the specified value.
	 */
	Stream.prototype.start = function(v) {
		var self = this;
		return Stream.create(function(n, e) {
			n(v);

			return self.fork(n, e);
		}, this.schedule);
	}

	/**
	 *	take :: Stream a -> int -> Stream a
	 *
	 *	Creates a stream that produces the first
	 *	v values this Stream produces.
	 */
	Stream.prototype.take = function(v) {
		return this.slice(0, v);
	}

	/**
	 *	skip :: Stream a -> int -> Stream a
	 *
	 *	Creates a stream that skips the first
	 *	v values this Stream produces.
	 */
	Stream.prototype.skip = function(v) {
		return this.slice(v, Infinity);
	}

	/**
	 *	take :: Stream a -> (int, int) -> Stream a
	 *
	 *	Creates a stream that produces the values
	 *	from this stream at positions in [start, end)
	 *
	 *	An unbounded stream will result if end is Infinity (
	 *	it will still end if the source ends though).
	 */
	Stream.prototype.slice = function(start, end) {
		var self = this;

		return Stream.create(function(n, e) {
			var c = 0;
			var disp = self.fork(function(x) {
				var upper = end !== Infinity ? (c < end) : true;
				var done = end !== Infinity ? (c === end - 1) : false;

				if (start <= c && upper)
					n(x);
				
				if (done) {
					disp();
					e();
				}

				c++;
			}, e);

			return function dispose() {
				disp();
			}
		}, this.schedule);
	}

	/**
	 *	delay :: Stream a -> int -> Stream a
	 *
	 *	Delays the production of values by this
	 *	stream by the specified amount. This does
	 *	not affect the time between produced values
	 *	in the resulting stream, just the time before
	 *	values are produced. The intervals between events
	 *	remains unchanged.
	 */
	Stream.prototype.delay = function(ms) {
		var self = this;
		return Stream.create(function(n, e) {
			var disp;

			var to = setTimeout(function() {
				disp = self.fork(function(v) {
					n(v);
				}, e);
			}, ms);

			return function dispose() {
				if (typeof disp === 'function')
					disp();

				clearTimeout(to);
			}
		}, this.schedule)
	}

	/**
	 *	throttle :: Stream a -> int -> Stream a
	 *
	 *	Creates a stream that produces values at
	 *	most once every ms milliseconds.
	 *
	 *	This does not preserve events in windows!
	 *	The debounce operation is meant to do that.
	 */
	Stream.prototype.throttle = function(ms) {
		var self = this;

		return Stream.create(function(n, e) {
			var last = 0;

			return self.fork(function(v) {
				var now = Date.now();
				if (last + ms < now) {
					last = now;
					n(v);
				}
			}, e);
		}, this.schedule);
	}

	/**
	 *	debounce :: Stream a -> int -> Stream a
	 *
	 *	Produces the last value in a burst of
	 *	events. At least ms milliseconds must pass
	 *	before another value is produced.
	 */
	Stream.prototype.debounce = function(ms) {
		var self = this;

		return Stream.create(function(n, e) {
			var last, val;

			return self.fork(function(v) {
				val = v;
				clearTimeout(last);
				last = setTimeout(function() {
					n(val);
				}, ms);
			}, e);
		}, this.schedule);
	}

	/**
	 *	tap :: Stream a -> (a -> b) -> Stream a
	 *
	 *	Perform a side effect in response to a value.
	 *
	 *	This should only be used for debugging!
	 */
	Stream.prototype.tap = function(f) {
		return this.map(function(x) {
			f(x);
			return x;
		});
	}

	/**
	 *	then :: Stream a -> Stream a -> Stream a
	 *
	 *	Produces the values in the specified stream
	 *	after this stream ends.
	 */
	Stream.prototype.then = function(o) {
		return Stream.fromList([this, o]).concat();
	}

	/**
	 *	scan :: Stream a -> ((b, a) -> b, b) -> Stream b
	 *
	 *	Acts as a time-varied fold on this stream with the
	 *	specified folding function and initial value. Each
	 *	accumulating value is produced by the resulting stream.
	 */
	Stream.prototype.scan = function(r, s) {
		var self = this;

		return Stream.create(function(n, e) {
			var acc = s;
			return self.fork(function(v) {
				acc = r(acc, v);
				n(acc);
			}, e);
		}, this.schedule);
	}

	/**
	 *	withState :: Stream a -> ((s, a) -> State s b) -> Stream b
	 *
	 *	Allows processing the values produced by this stream
	 *	with state that can be manipulated each time a value is
	 *	seen. Each resulting value is produced by the resulting stream.
	 *
	 *	State s b :: Object
	 *	Object with state property of type s and
	 *	value property of type b.
	 */
	Stream.prototype.withState = function(r, s) {
		return this.scan(function(acc, v) {
			return r(acc.state, v);
		}, {state: s}).map(function(acc) {
			return acc.value;
		});
	}

	/**
	 *	op :: Stream a -> (Stream a -> b) -> b
	 *
	 *	Fluently apply an operation to this Stream.
	 *
	 *	f does not need to be an operation, but this
	 *	is most useful with operations on Streams. Any
	 *	function that consumes a Stream will work.
	 */
	Stream.prototype.op = function(f) {
		return f(this);
	}

	/**
	 *	combine :: Stream a -> (Stream b, ..., Stream z) -> Stream (a, b, ..., z)
	 *
	 *	Produces tuples containing the latest values from this stream
	 *	and each of the specified streams.
	 */
	Stream.prototype.combine = function() {
		var args = Array.prototype.slice.call(arguments);
		return Stream.combine.apply(Stream, [this].concat(args));
	}

	/**
	 *	combine :: (Stream a, Stream b, ..., Stream z) -> Stream (a, b, ..., z)
	 *
	 *	Produces tuples containing the latest values from each of
	 *	the specified streams.
	 */
	Stream.combine = function() {
		var args = Array.prototype.slice.call(arguments);
		
		var add = function(x) {
			return function(acc) {
				acc = [].concat(acc);
				acc.push(x);

				return acc;
			}
		}

		return args.reduce(function(acc, x) {
			return x.map(add).app(acc);
		}, Stream.of([]));
	}

	/**
	 *	iterate :: (a -> a | Promise a, a, Scheduler, int) -> Stream a
	 *
	 *	Creates an infinite stream whose values are produced
	 *	from the provided seed and iterating function.
	 *
	 *	The iterating function can return Promises to control the
	 *	iteration speed. If Promises are not returned, then iteration
	 *	speed is determined by the specified scheduler and limit (limit
	 *	iterations are performed and the values produced are emitted, then
	 *	another round of iteration is scheduled).
	 */
	Stream.iterate = function(f, s, schedule, limit) {
		limit = limit || 100;
		schedule = schedule || Stream.defaultScheduler;
		return Stream.create(function(n, e) {
			var v = s, disped;

			function isPromise(x) {
				return typeof x === 'object' 
				  && typeof x.then === 'function';
			}

			function run(x) {
				var i = limit;
				while (i-- && !isPromise(x)) {
					n(x);
					x = f(x);
				}

				return x;
			}

			function step(vv) {
				//don't run work if disposed
				if (disped)
					return false;

				v = run(vv || v);

				//don't schedule work if disposed
				if (disped)
					return false;

				if (isPromise(v))
					v.then(step);
				else
					schedule(step);
			}

			step();

			return function dispose() {
				disped = true;
			}
		}, schedule);
	}


	/**
	 *	range :: (int, int) -> Stream int
	 *
	 *	Returns a string that produces all integers
	 *	in the interval [start, end). This is equivalent
	 *	to `iterate(succ, 0).slice(start, end)`, but implemented
	 *	with a tight loop, so it is likely more efficient.
	 *
	 *	If you need a very large range, use the aforementioned
	 *	equivalent as it will share time better by breaking up
	 *	the iteration.
	 */
	Stream.range = function(start, end) {
		return Stream.create(function(n, e) {
			for (var i = start; i < end; i++) {
				n(i);
			}
			e();

			return function dispose() {

			}
		});
	}

	/**
	 *	multicast :: Stream a -> Stream a
	 *
	 *	Creates a Stream that produces the same values as this
	 *	Stream, but shares the underlying computations used to
	 *	construct those values. This also remembers the last value,
	 *	which is provided to new subscribers.
	 *
	 *	This is useful to limit the number of side effects that
	 *	occur, and in some cases is required (such as when a side
	 *	effect can only be ran once).
	 *
	 *	Aliases: remember
	 */
	Stream.prototype.multicast = function() {
		var ns = [], es = [], disp, self = this, last, lastSet;

		return Stream.create(function(n, e) {
			ns.push(n);
			es.push(e);

			if (lastSet)
				n(last);

			if (ns.length === 1) {
				disp = self.fork(function(v) {
					last = v;
					lastSet = true;
					ns.forEach(T(v));
				}, function() {
					es.forEach(T());
				});
			}

			return function dispose() {
				ns = ns.filter(function(x) {
					return x !== n;
				});

				es = es.filter(function(x) {
					return x !== e;
				});

				if (ns.length === 0) {
					disp();
				}
			}
		})
	}

	Stream.prototype.remember = Stream.prototype.multicast;


/** Helpers **/
	/**
	 *	scheduled :: Stream a -> (a -> b) -> (a -> ())
	 *
	 *	Wraps a continuation as a thunk that when applied
	 *	will defer the evaluation of the continuation using
	 *	the current scheduler.
	 */
	Stream.prototype.scheduled = function(f) {
		var schedule = this.schedule;
		return function() {
			var args = Array.prototype.slice.call(arguments);

			args.unshift(null);

			schedule(f.bind.apply(f, args));
		}
	}

	/**
	 *	fork :: Stream a -> Computation a -> (() -> ())
	 *
	 *	Forks a Stream, causing it to start producing values.
	 */
	Stream.prototype.fork = function(n, e) {
		var self = this;
		var disposed = false;
		var disposer;

		this.schedule(function() {
			if (!disposed)
				disposer = self.thunk(
					self.scheduled(n),
					self.scheduled(e)
				);
		});

		return function dispose() {
			if (typeof disposer === 'function')
				disposer();

			disposed = true;
		}
	}

	/**
	 *	observe :: Stream a -> (a -> ()) -> Promise () ()
	 *
	 *	Forks the Stream. Each value is provided to the specified
	 *	continuation. The resulting Promise is resolved when the
	 *	Stream ends.
	 *
	 *	Aliases: forEach
	 */
	Stream.prototype.observe = function(n) {
		var self = this;
		return new Promise(function(res, rej) {
			self.fork(n, res);
		});
	}

	Stream.prototype.forEach = Stream.prototype.observe;

	/**
	 *	subscribe :: Stream a -> Observer a -> Subscription
	 *
	 *	Forks the Stream. Returns a subscription that can be
	 *	used to imperatively unsubscribe.
	 */
	Stream.prototype.subscribe = function(observer) {
		if (typeof observer !== 'object')
			throw new Error('Observer must be an object');

		if (typeof observer.next !== 'function')
			throw new Error('Invalid Observer: no next method!');

		if (typeof observer.complete !== 'function')
			throw new Error('Invalid Observer: no complete method!');

		return {
			unsubscribe: this.fork(observer.next, observer.complete)
		};
	}

	var sched = 
		typeof setImmediate === 'function' ? setImmediate : setTimeout;
	/**
	 *	defaultScheduler :: (() -> ()) -> ()
	 *
	 *	The default scheduler to use when none is specified.
	 */
	Stream.defaultScheduler = function(x) {
		sched(x, 0);
	}

	/**
	 *	fst :: a -> b -> a
	 *
	 *	Returns its first argument.
	 */
	function fst(a) {
		return function(b) {
			return a;
		}
	}

	/**
	 *	snd :: a -> b -> b
	 *
	 *	Returns its second argument.
	 */
	function snd(a) {
		return function(b) {
			return b;
		}
	}

	/**
	 *	T :: a -> (a -> b) -> b
	 *
	 *	The T combinator.
	 */
	function T(x) {
		return function(f) {
			return f(x);
		}
	}


	//export
	if (typeof module === 'object' && typeof module.exports === 'object') {
		module.exports = Stream;
	}
	else if (typeof window === 'object') {
		window.Stream = Stream;
	}
})();