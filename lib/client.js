window.__ModuleLoader__.load({
	id: "dsh-water-reminder",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		const STORAGE_KEY = "dsh-water-reminder:v1";
		const COOKIE_KEY = "dsh_water_reminder";
		const DEFAULT_INTERVAL_MIN = 45;
		const INTERVAL_OPTIONS = [15, 30, 45, 60, 90];
		const SNOOZE_MIN = 5;
		const CUP_ML = 250;

		const STRINGS = {
			zh: {
				title: "喝水提醒",
				toggle: "开启或暂停喝水提醒",
				sub: (min) => `每 ${min} 分钟提醒一次`,
				paused: "提醒已暂停",
				min: "分钟",
				intervalLabel: "提醒间隔（分钟）",
				next: "距下次提醒",
				drink: "我喝水了",
				snooze: "稍后 5 分钟",
				snoozeShort: "稍后",
				test: "测试提醒",
				cupsLabel: "今日杯数",
				lastDrink: "上次喝水",
				soundOn: "🔔 提示音开",
				soundOff: "🔕 提示音关",
				reset: "清空今日",
				notifyOn: "● 系统通知已开启",
				notifyAsk: "开启系统通知",
				notifyDenied: "系统通知未授权",
				notifyUnsupported: "当前环境不支持系统通知",
				notifyTitle: "该喝水啦 💧",
				notifyBody: "放下手头的事，喝几口水吧。",
				toastTitle: "该喝水啦",
				toastBody: (min) => `已经 ${min} 分钟了，起来喝口水吧。`,
				cupsToday: (n) => `今日第 ${n} 杯 · 每杯 ${CUP_ML} ml`,
				dismiss: "关闭提醒",
			},
			en: {
				title: "Water Reminder",
				toggle: "Enable or pause the water reminder",
				sub: (min) => `Remind me every ${min} min`,
				paused: "Reminder paused",
				min: "min",
				intervalLabel: "Interval (minutes)",
				next: "Next reminder in",
				drink: "I drank water",
				snooze: "Snooze 5 min",
				snoozeShort: "Snooze",
				test: "Test",
				cupsLabel: "Cups today",
				lastDrink: "Last drink",
				soundOn: "🔔 Sound on",
				soundOff: "🔕 Sound off",
				reset: "Reset today",
				notifyOn: "● System notifications on",
				notifyAsk: "Enable system notifications",
				notifyDenied: "System notifications blocked",
				notifyUnsupported: "System notifications unavailable",
				notifyTitle: "Time to drink water 💧",
				notifyBody: "Pause for a moment and take a few sips.",
				toastTitle: "Time to drink water",
				toastBody: (min) => `${min} minutes have passed. Get up and take a sip.`,
				cupsToday: (n) => `Cup ${n} today · ${CUP_ML} ml each`,
				dismiss: "Dismiss reminder",
			},
		};

		function pickStrings() {
			const lang = (typeof navigator !== "undefined" && navigator.language) || "";
			return lang.toLowerCase().startsWith("zh") ? STRINGS.zh : STRINGS.en;
		}

		function dayKey(date) {
			const d = date || new Date();
			return [
				d.getFullYear(),
				String(d.getMonth() + 1).padStart(2, "0"),
				String(d.getDate()).padStart(2, "0"),
			].join("-");
		}

		function readSaved() {
			try {
				const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_KEY + "=([^;]+)"));
				if (match) return JSON.parse(decodeURIComponent(match[1]));
			} catch (error) {}
			try {
				return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
			} catch (error) {
				return null;
			}
		}

		function writeSaved(state) {
			const raw = JSON.stringify(state);
			try {
				localStorage.setItem(STORAGE_KEY, raw);
			} catch (error) {}
			try {
				document.cookie = COOKIE_KEY + "=" + encodeURIComponent(raw) + "; Max-Age=31536000; Path=/; SameSite=Lax";
			} catch (error) {}
		}

		function loadState() {
			const now = Date.now();
			const saved = readSaved();
			const state = {
				enabled: true,
				intervalMin: DEFAULT_INTERVAL_MIN,
				nextAt: now + DEFAULT_INTERVAL_MIN * 60000,
				cups: 0,
				totalMl: 0,
				day: dayKey(),
				sound: true,
				lastDrinkAt: 0,
			};
			if (saved && typeof saved === "object") {
				if (typeof saved.enabled === "boolean") state.enabled = saved.enabled;
				if (INTERVAL_OPTIONS.indexOf(saved.intervalMin) >= 0) state.intervalMin = saved.intervalMin;
				if (typeof saved.nextAt === "number" && isFinite(saved.nextAt)) state.nextAt = saved.nextAt;
				if (typeof saved.cups === "number" && saved.cups >= 0) state.cups = Math.floor(saved.cups);
				if (typeof saved.totalMl === "number" && saved.totalMl >= 0) state.totalMl = Math.floor(saved.totalMl);
				if (typeof saved.day === "string") state.day = saved.day;
				if (typeof saved.sound === "boolean") state.sound = saved.sound;
				if (typeof saved.lastDrinkAt === "number") state.lastDrinkAt = saved.lastDrinkAt;
			}
			const today = dayKey();
			if (state.day !== today) {
				state.day = today;
				state.cups = 0;
				state.totalMl = 0;
			}
			if (!state.enabled) state.nextAt = now + state.intervalMin * 60000;
			return state;
		}

		let audioCtx = null;

		function beep() {
			try {
				const AudioCtor = window.AudioContext || window.webkitAudioContext;
				if (!AudioCtor) return;
				if (!audioCtx) audioCtx = new AudioCtor();
				if (audioCtx.state === "suspended") audioCtx.resume();
				const start = audioCtx.currentTime;
				[0, 0.18].forEach((offset, index) => {
					const osc = audioCtx.createOscillator();
					const gain = audioCtx.createGain();
					osc.type = "sine";
					osc.frequency.setValueAtTime(index === 0 ? 880 : 1174.66, start + offset);
					gain.gain.setValueAtTime(0.0001, start + offset);
					gain.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.02);
					gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.3);
					osc.connect(gain);
					gain.connect(audioCtx.destination);
					osc.start(start + offset);
					osc.stop(start + offset + 0.34);
				});
			} catch (error) {}
		}

		function systemNotify(title, body) {
			try {
				if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
				const notification = new Notification(title, {
					body,
					tag: "dsh-water-reminder",
					renotify: true,
					silent: true,
				});
				notification.onclick = () => {
					try {
						window.focus();
					} catch (error) {}
					notification.close();
				};
			} catch (error) {}
		}

		function formatClock(ms) {
			const total = Math.max(0, Math.ceil(ms / 1000));
			const hours = Math.floor(total / 3600);
			const minutes = Math.floor((total % 3600) / 60);
			const seconds = total % 60;
			const mm = String(minutes).padStart(2, "0");
			const ss = String(seconds).padStart(2, "0");
			return hours > 0 ? hours + ":" + mm + ":" + ss : mm + ":" + ss;
		}

		function formatTime(timestamp) {
			try {
				return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			} catch (error) {
				return "—";
			}
		}

		const CSS = `
.dswr-root{position:fixed;inset:0;z-index:30;pointer-events:none;font-family:inherit}
.dswr-fab{position:absolute;right:22px;bottom:22px;width:58px;height:58px;padding:0;border:0;border-radius:50%;
  cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(145deg,#5cc8ff,#2f7cf6);box-shadow:0 10px 26px rgba(47,124,246,.38);
  transition:transform .18s ease,box-shadow .18s ease;-webkit-tap-highlight-color:transparent}
.dswr-fab:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(47,124,246,.46)}
.dswr-fab:active{transform:scale(.96)}
.dswr-fab:focus-visible{outline:2px solid #fff;outline-offset:2px}
.dswr-fab[data-due="true"]{animation:dswrPulse 1.8s ease-in-out infinite}
.dswr-ring{position:absolute;inset:0;width:58px;height:58px;transform:rotate(-90deg);pointer-events:none}
.dswr-drop{width:24px;height:24px;color:#fff;position:relative;z-index:1;filter:drop-shadow(0 1px 1px rgba(0,40,90,.18))}
.dswr-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;
  background:#fff;color:#2f7cf6;font-size:11px;font-weight:700;line-height:20px;text-align:center;
  box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:2}
.dswr-panel{position:absolute;right:22px;bottom:92px;width:322px;max-width:calc(100vw - 28px);
  max-height:calc(100vh - 140px);overflow:auto;pointer-events:auto;box-sizing:border-box;padding:16px;
  border-radius:18px;background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary,#17181a);
  border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));box-shadow:0 20px 60px rgba(20,40,80,.24);
  animation:dswrPop .18s ease-out}
.dswr-head{display:flex;align-items:center;gap:9px}
.dswr-logo{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  color:#fff;background:linear-gradient(145deg,#5cc8ff,#2f7cf6);flex:none}
.dswr-logo svg{width:17px;height:17px}
.dswr-head-text{flex:1;min-width:0}
.dswr-title{font-size:15px;font-weight:600;line-height:20px}
.dswr-sub{font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#8a8f98);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dswr-switch{position:relative;width:38px;height:22px;flex:none;border:0;border-radius:11px;cursor:pointer;
  background:var(--dsw-alias-border-l3,#d8dbe2);transition:background .18s ease;padding:0}
.dswr-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;
  background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.24);transition:transform .18s ease}
.dswr-switch[data-on="true"]{background:#2f7cf6}
.dswr-switch[data-on="true"]::after{transform:translateX(16px)}
.dswr-chips{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:0 0 14px}
.dswr-label{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8f98);margin:12px 0 6px}
.dswr-chip{border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:9px;padding:6px 0;text-align:center;
  font-size:12px;line-height:16px;font-variant-numeric:tabular-nums;color:inherit;background:transparent;cursor:pointer;transition:all .15s ease}
.dswr-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(47,124,246,.08))}
.dswr-chip[data-active="true"]{background:#2f7cf6;border-color:#2f7cf6;color:#fff}
.dswr-count{padding:10px 12px 11px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(47,124,246,.07));margin-bottom:12px}
.dswr-count-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.dswr-count-label{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dswr-count-time{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.5px;color:#2f7cf6}
.dswr-bar{height:4px;border-radius:2px;background:rgba(47,124,246,.16);overflow:hidden;margin-top:8px}
.dswr-bar i{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,#5cc8ff,#2f7cf6);transition:width .6s linear}
.dswr-stats{display:flex;gap:8px;margin-bottom:12px}
.dswr-stat{flex:1;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}
.dswr-stat b{display:block;font-size:16px;line-height:22px;font-weight:600;font-variant-numeric:tabular-nums}
.dswr-stat span{display:block;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8a8f98);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dswr-primary{width:100%;height:38px;border:0;border-radius:10px;cursor:pointer;color:#fff;font-size:14px;font-weight:600;
  background:linear-gradient(145deg,#4fb6ff,#2f7cf6);box-shadow:0 6px 16px rgba(47,124,246,.28);transition:filter .15s ease,transform .15s ease}
.dswr-primary:hover{filter:brightness(1.04)}
.dswr-primary:active{transform:scale(.99)}
.dswr-row{display:flex;gap:8px;margin-top:8px}
.dswr-ghost{flex:1;height:32px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));
  background:transparent;color:inherit;font-size:12px;cursor:pointer;transition:background .15s ease}
.dswr-ghost:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(47,124,246,.08))}
.dswr-foot{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:10px;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dswr-link{border:0;background:transparent;color:inherit;font-size:11px;padding:2px 0;cursor:pointer;white-space:nowrap}
.dswr-link:hover{color:var(--dsw-alias-label-primary,#17181a)}
.dswr-spacer{flex:1}
.dswr-ok{color:#22a06b;white-space:nowrap}
.dswr-toast{position:fixed;left:50%;top:calc(var(--dsh-frame-overlay-top,68px) + 4px);transform:translateX(-50%);
  width:min(430px,calc(100vw - 28px));box-sizing:border-box;display:flex;align-items:flex-start;gap:12px;
  padding:14px;border-radius:16px;pointer-events:auto;z-index:31;
  background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary,#17181a);
  border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));box-shadow:0 18px 50px rgba(20,40,80,.26);
  animation:dswrSlide .24s cubic-bezier(.2,.9,.3,1.2)}
.dswr-toast-icon{width:38px;height:38px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;
  color:#fff;background:linear-gradient(145deg,#5cc8ff,#2f7cf6)}
.dswr-toast-icon svg{width:20px;height:20px}
.dswr-toast-body{flex:1;min-width:0}
.dswr-toast-title{font-size:14px;font-weight:600;line-height:20px}
.dswr-toast-text{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#5c6370);margin-top:2px}
.dswr-toast-meta{font-size:11px;line-height:16px;color:#2f7cf6;margin-top:4px}
.dswr-toast-actions{display:flex;flex-direction:column;gap:6px;flex:none}
.dswr-primary-sm{width:auto;height:30px;padding:0 12px;font-size:12px;box-shadow:none;white-space:nowrap}
.dswr-ghost-sm{flex:none;height:26px;padding:0 10px;font-size:11px}
.dswr-x{position:absolute;top:6px;right:6px;width:22px;height:22px;border:0;border-radius:50%;background:transparent;
  color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:16px;line-height:20px;cursor:pointer}
.dswr-x:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
@keyframes dswrPulse{0%,100%{box-shadow:0 10px 26px rgba(47,124,246,.38)}50%{box-shadow:0 10px 26px rgba(47,124,246,.38),0 0 0 10px rgba(47,124,246,.14)}}
@keyframes dswrPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@keyframes dswrSlide{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}
@media (prefers-reduced-motion:reduce){.dswr-fab,.dswr-panel,.dswr-toast{animation:none!important;transition:none!important}}
`;

		if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="dsh-water-reminder"]')) {
			const style = document.createElement("style");
			style.dataset.plugin = "dsh-water-reminder";
			style.dataset.pluginCss = "dsh-water-reminder";
			style.textContent = CSS;
			document.head.appendChild(style);
		}

		function DropIcon(props) {
			return h(
				"svg",
				{
					viewBox: "0 0 24 24",
					fill: "currentColor",
					"aria-hidden": "true",
					className: props && props.className,
				},
				h("path", {
					d: "M12 2.2c3.4 4 6.4 7.4 6.4 10.9a6.4 6.4 0 1 1-12.8 0C5.6 9.6 8.6 6.2 12 2.2Z",
				}),
			);
		}

		function WaterReminder() {
			const t = pickStrings();
			const [state, setState] = React.useState(loadState);
			const [now, setNow] = React.useState(() => Date.now());
			const [open, setOpen] = React.useState(false);
			const [toast, setToast] = React.useState(null);
			const [permission, setPermission] = React.useState(() => {
				try {
					return typeof Notification !== "undefined" ? Notification.permission : "unsupported";
				} catch (error) {
					return "unsupported";
				}
			});

			React.useEffect(() => {
				writeSaved(state);
			}, [state]);

			React.useEffect(() => {
				const timer = setInterval(() => setNow(Date.now()), 1000);
				return () => clearInterval(timer);
			}, []);

			React.useEffect(() => {
				if (!open) return undefined;
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				window.addEventListener("keydown", onKeyDown);
				return () => window.removeEventListener("keydown", onKeyDown);
			}, [open]);

			React.useEffect(() => {
				if (!state.enabled) return;
				if (now < state.nextAt) return;
				const firedAt = Date.now();
				if (state.sound) beep();
				systemNotify(t.notifyTitle, t.notifyBody);
				setToast({ at: firedAt });
				setState((current) => ({
					...current,
					nextAt: firedAt + current.intervalMin * 60000,
				}));
			}, [now, state.enabled, state.nextAt]);

			const remaining = state.enabled ? Math.max(0, state.nextAt - now) : 0;
			const total = Math.max(1, state.intervalMin * 60000);
			const progress = state.enabled ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
			const radius = 25;
			const circumference = 2 * Math.PI * radius;

			function askNotificationPermission() {
				try {
					if (typeof Notification === "undefined") return;
					if (Notification.permission !== "default") {
						setPermission(Notification.permission);
						return;
					}
					const result = Notification.requestPermission();
					if (result && typeof result.then === "function") {
						result.then((value) => setPermission(value)).catch(() => {});
					} else {
						setPermission(Notification.permission);
					}
				} catch (error) {}
			}

			function toggleEnabled() {
				const turningOn = !state.enabled;
				const at = Date.now();
				setState((current) => ({
					...current,
					enabled: turningOn,
					nextAt: turningOn ? at + current.intervalMin * 60000 : current.nextAt,
				}));
				if (turningOn) askNotificationPermission();
				else setToast(null);
			}

			function chooseInterval(minutes) {
				const at = Date.now();
				setState((current) => ({
					...current,
					intervalMin: minutes,
					nextAt: current.enabled ? at + minutes * 60000 : current.nextAt,
				}));
			}

			function drink() {
				const at = Date.now();
				setState((current) => {
					const today = dayKey();
					const fresh = current.day === today
						? current
						: { ...current, day: today, cups: 0, totalMl: 0 };
					return {
						...fresh,
						cups: fresh.cups + 1,
						totalMl: fresh.totalMl + CUP_ML,
						lastDrinkAt: at,
						nextAt: at + fresh.intervalMin * 60000,
					};
				});
				setToast(null);
			}

			function snooze(minutes) {
				const at = Date.now();
				setState((current) => ({
					...current,
					nextAt: at + (minutes || SNOOZE_MIN) * 60000,
				}));
				setToast(null);
			}

			function testReminder() {
				if (state.sound) beep();
				systemNotify(t.notifyTitle, t.notifyBody);
				setToast({ at: Date.now() });
			}

			function resetToday() {
				setState((current) => ({
					...current,
					day: dayKey(),
					cups: 0,
					totalMl: 0,
					lastDrinkAt: 0,
				}));
			}

			const notifyControl = (() => {
				if (permission === "granted") return h("span", { className: "dswr-ok" }, t.notifyOn);
				if (permission === "denied") return h("span", null, t.notifyDenied);
				if (permission === "unsupported") return h("span", null, t.notifyUnsupported);
				return h("button", { className: "dswr-link", onClick: askNotificationPermission }, t.notifyAsk);
			})();

			const fab = h(
				"button",
				{
					className: "dswr-fab",
					type: "button",
					"data-due": toast ? "true" : "false",
					"aria-label": t.title,
					title: state.enabled ? t.next + " " + formatClock(remaining) : t.paused,
					onClick: () => setOpen((value) => !value),
				},
				h(
					"svg",
					{ className: "dswr-ring", viewBox: "0 0 58 58", "aria-hidden": "true" },
					h("circle", {
						cx: 29,
						cy: 29,
						r: radius,
						fill: "none",
						stroke: "rgba(255,255,255,.28)",
						strokeWidth: 3,
					}),
					h("circle", {
						cx: 29,
						cy: 29,
						r: radius,
						fill: "none",
						stroke: "#fff",
						strokeWidth: 3,
						strokeLinecap: "round",
						strokeDasharray: circumference,
						strokeDashoffset: circumference * (1 - progress),
						style: { transition: "stroke-dashoffset .6s linear" },
					}),
				),
				h(DropIcon, { className: "dswr-drop" }),
				state.cups > 0 ? h("span", { className: "dswr-badge" }, String(state.cups)) : null,
			);

			const panel = open
				? h(
					"div",
					{ className: "dswr-panel", role: "dialog", "aria-label": t.title },
					h(
						"div",
						{ className: "dswr-head" },
						h("span", { className: "dswr-logo" }, h(DropIcon, null)),
						h(
							"div",
							{ className: "dswr-head-text" },
							h("div", { className: "dswr-title" }, t.title),
							h("div", { className: "dswr-sub" }, state.enabled ? t.sub(state.intervalMin) : t.paused),
						),
						h("button", {
							className: "dswr-switch",
							type: "button",
							role: "switch",
							"aria-checked": state.enabled,
							"aria-label": t.toggle,
							"data-on": state.enabled ? "true" : "false",
							onClick: toggleEnabled,
						}),
					),
					h("div", { className: "dswr-label" }, t.intervalLabel),
					h(
						"div",
						{ className: "dswr-chips" },
						INTERVAL_OPTIONS.map((minutes) =>
							h(
								"button",
								{
									key: minutes,
									type: "button",
									className: "dswr-chip",
									title: minutes + " " + t.min,
									"data-active": minutes === state.intervalMin ? "true" : "false",
									onClick: () => chooseInterval(minutes),
								},
								String(minutes),
							),
						),
					),
					h(
						"div",
						{ className: "dswr-count" },
						h(
							"div",
							{ className: "dswr-count-row" },
							h("span", { className: "dswr-count-label" }, state.enabled ? t.next : t.paused),
							h("b", { className: "dswr-count-time" }, state.enabled ? formatClock(remaining) : "--:--"),
						),
						h("div", { className: "dswr-bar" }, h("i", { style: { width: Math.round(progress * 100) + "%" } })),
					),
					h(
						"div",
						{ className: "dswr-stats" },
						h(
							"div",
							{ className: "dswr-stat" },
							h("b", null, String(state.cups)),
							h("span", null, t.cupsLabel),
						),
						h(
							"div",
							{ className: "dswr-stat" },
							h("b", null, String(state.totalMl)),
							h("span", null, "ml"),
						),
						h(
							"div",
							{ className: "dswr-stat" },
							h("b", null, state.lastDrinkAt ? formatTime(state.lastDrinkAt) : "—"),
							h("span", null, t.lastDrink),
						),
					),
					h("button", { className: "dswr-primary", type: "button", onClick: drink }, t.drink),
					h(
						"div",
						{ className: "dswr-row" },
						h("button", { className: "dswr-ghost", type: "button", onClick: () => snooze(SNOOZE_MIN) }, t.snooze),
						h("button", { className: "dswr-ghost", type: "button", onClick: testReminder }, t.test),
					),
					h(
						"div",
						{ className: "dswr-foot" },
						h(
							"button",
							{
								className: "dswr-link",
								type: "button",
								onClick: () => setState((current) => ({ ...current, sound: !current.sound })),
							},
							state.sound ? t.soundOn : t.soundOff,
						),
						h("span", null, "·"),
						notifyControl,
						h("span", { className: "dswr-spacer" }),
						h("button", { className: "dswr-link", type: "button", onClick: resetToday }, t.reset),
					),
				)
				: null;

			const toastView = toast
				? h(
					"div",
					{ className: "dswr-toast", role: "status", key: toast.at },
					h("div", { className: "dswr-toast-icon" }, h(DropIcon, null)),
					h(
						"div",
						{ className: "dswr-toast-body" },
						h("div", { className: "dswr-toast-title" }, t.toastTitle),
						h("div", { className: "dswr-toast-text" }, t.toastBody(state.intervalMin)),
						h("div", { className: "dswr-toast-meta" }, t.cupsToday(state.cups)),
					),
					h(
						"div",
						{ className: "dswr-toast-actions" },
						h("button", { className: "dswr-primary dswr-primary-sm", type: "button", onClick: drink }, t.drink),
						h("button", { className: "dswr-ghost dswr-ghost-sm", type: "button", onClick: () => snooze(SNOOZE_MIN) }, t.snoozeShort),
					),
					h("button", { className: "dswr-x", type: "button", "aria-label": t.dismiss, onClick: () => setToast(null) }, "×"),
				)
				: null;

			return h(React.Fragment, null, h("div", { className: "dswr-root" }, panel, fab), toastView);
		}

		function apply(ctx) {
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({
					name: "shell.overlay",
					id: "water-reminder",
					order: 50,
				}, WaterReminder),
			);
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	},
});
