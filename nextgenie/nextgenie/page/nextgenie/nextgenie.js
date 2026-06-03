// Copyright (c) 2025, Codeventurers and contributors
// For license information, please see license.txt

frappe.pages['nextgenie'].on_page_load = function (wrapper) {

	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'NextGenie',
		single_column: true
	});

	// Hide Frappe page title bar
	setTimeout(function () {
		$(wrapper).find('.page-head').hide();
		$(wrapper).closest('.page-wrapper').find('.page-head').hide();
	}, 0);

	page.main.css({ 'padding': '0', 'margin': '0' });
	$(page.main).addClass('ng-page-main');

	$(frappe.render_template("nextgenie")).appendTo(page.main);

	// ── State ────────────────────────────────────────
	var sessions = [];
	var activeId = null;

	// ── Helpers ──────────────────────────────────────

	function getTime() {
		return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function scrollBottom() {
		var el = document.getElementById('chat-messages');
		if (el) el.scrollTop = el.scrollHeight;
	}

	// ── Render history list ───────────────────────────

	function renderHistory() {
		var $list = $('#hist-list').empty();
		sessions.forEach(function (s) {
			var $item = $('<div>')
				.addClass('hist-item')
				.toggleClass('active', s.id === activeId);

			$('<div>').addClass('hist-item-title').text(s.title).appendTo($item);
			$('<div>').addClass('hist-item-date').text(s.date || '').appendTo($item);

			$item.on('click', function () { loadSession(s.id); });
			$list.append($item);
		});
	}

	// ── Load session messages ─────────────────────────

	function loadSession(id) {
		activeId = id;
		var s = sessions.find(function (x) { return x.id === id; });
		if (s) $('#chat-header-title').text(s.title);
		$('#chat-messages').empty();
		renderHistory();

		frappe.call({
			method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.get_session_messages',
			args: { session_id: id },
			callback: function (r) {
				if (r.message && r.message.length) {
					r.message.forEach(function (m) {
						appendMessage(m.sender, m.message, false);
					});
				}
			}
		});
	}

	// ── Append message bubble ─────────────────────────

	function appendMessage(sender, text, animate) {
		if (animate === undefined) animate = true;
		var isUser = (sender === 'User');

		// Row
		var $row = $('<div>').addClass('ng-msg-row');
		if (isUser) $row.addClass('ng-user');
		if (!animate) $row.css('animation', 'none');

		// Avatar
		var $av = $('<div>')
			.addClass('ng-avatar')
			.addClass(isUser ? 'ng-av-user' : 'ng-av-bot')
			.text(isUser ? '👤' : '✦');

		// Bubble wrapper
		var $wrap = $('<div>').addClass('ng-bubble-wrap');

		// Bubble — use .text() so no HTML injection and no char-wrap
		var $bub = $('<div>')
			.addClass('ng-bubble')
			.addClass(isUser ? 'ng-usr' : 'ng-bot')
			.text(text);

		// Timestamp
		var $time = $('<div>').addClass('ng-time').text(getTime());

		$wrap.append($bub).append($time);
		$row.append($av).append($wrap);
		$('#chat-messages').append($row);
		scrollBottom();
	}

	function showTyping() {
		var $row = $('<div>').addClass('ng-msg-row').attr('id', 'ng-typing-row');
		var $av = $('<div>').addClass('ng-avatar ng-av-bot').text('✦');
		var $typ = $('<div>').addClass('ng-typing')
			.append($('<span>')).append($('<span>')).append($('<span>'));
		$row.append($av).append($typ);
		$('#chat-messages').append($row);
		scrollBottom();
	}

	function hideTyping() {
		$('#ng-typing-row').remove();
	}

	// ── Load all sessions ─────────────────────────────

	function loadSessions() {
		frappe.call({
			method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.get_sessions',
			callback: function (r) {
				if (r.message && r.message.length) {
					sessions = r.message;
					renderHistory();
					loadSession(sessions[0].id);
				} else {
					createNewSession();
				}
			}
		});
	}

	// ── Create new session ────────────────────────────

	function createNewSession() {
		frappe.call({
			method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.create_session',
			callback: function (r) {
				if (r.message) {
					sessions.unshift(r.message);
					activeId = r.message.id;
					$('#chat-messages').empty();
					$('#chat-header-title').text('New Chat');
					renderHistory();

					var welcome = "👋 Hello! I'm NextGenie, your private HR assistant. How can I help you today?";
					appendMessage('Genie', welcome);
					frappe.call({
						method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.add_chat_message',
						args: { session_id: activeId, sender: 'Genie', message: welcome }
					});
				}
			}
		});
	}

	// ── Send message ──────────────────────────────────

	function sendMessage() {
		var $input = $('#chat-input-box');
		var message = $input.val().trim();
		if (!message) return;

		appendMessage('User', message);
		$input.val('');

		// Auto-rename on first message
		var s = sessions.find(function (x) { return x.id === activeId; });
		if (s && s.title === 'New Chat') {
			s.title = message.length > 28 ? message.slice(0, 28) + '…' : message;
			$('#chat-header-title').text(s.title);
			renderHistory();
			frappe.call({
				method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.update_session_title',
				args: { session_id: activeId, title: s.title }
			});
		}

		// Save user message
		frappe.call({
			method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.add_chat_message',
			args: { session_id: activeId, sender: 'User', message: message }
		});

		showTyping();

		// Get AI reply
		frappe.call({
			method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.get_ai_reply',
			args: { session_id: activeId, message: message },
			callback: function (r) {
				hideTyping();
				var reply = (r.message && r.message.reply)
					? r.message.reply
					: "I'm here to help! Could you clarify your question?";
				appendMessage('Genie', reply);
				frappe.call({
					method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.add_chat_message',
					args: { session_id: activeId, sender: 'Genie', message: reply }
				});
			},
			error: function () {
				hideTyping();
				appendMessage('Genie', '⚠️ Something went wrong. Please try again.');
			}
		});
	}

	// ── Events ────────────────────────────────────────

	$(document).on('click', '#send-btn', sendMessage);

	$(document).on('keypress', '#chat-input-box', function (e) {
		if (e.which === 13) sendMessage();
	});

	$(document).on('click', '#new-chat-btn', createNewSession);

	$(document).on('click', '#clear-btn', function () {
		if (confirm('Clear this chat?')) {
			frappe.call({
				method: 'nextgenie.nextgenie.page.nextgenie.nextgenie.clear_session_messages',
				args: { session_id: activeId },
				callback: function () {
					$('#chat-messages').empty();
					appendMessage('Genie', 'Chat cleared. How can I assist you?');
				}
			});
		}
	});

	$(document).on('click', '#quick-actions li', function () {
		var msg = $(this).data('msg');
		if (msg) {
			$('#chat-input-box').val(msg);
			sendMessage();
		}
	});

	// ── Boot ─────────────────────────────────────────
	loadSessions();
};