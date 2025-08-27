// Copyright(c) 2025, Codeventurers and contributors
// For license information, please see license.txt

frappe.pages['nextgenie'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'NextGenie Chat',
		single_column: true
	});

	$(frappe.render_template("nextgenie")).appendTo(page.body);

	frappe.call({
		method: "nextgenie.nextgenie.page.nextgenie.nextgenie.get_chat_history",
		args: { limit: 50 },
		callback: function (r) {
			if (r.message) {
				r.message.forEach(msg => {
					let css_class = msg.sender === "User" ? "user-message" : "bot-message";
					$("#chat-messages").append(`<div class="${css_class}">${msg.message}</div>`);
				});
				$("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);
			}
		}
	});

	// Send message
	$(document).on("click", "#send-btn", function () {
		sendMessage();
	});

	$(document).on("keypress", "#chat-input-box", function (e) {
		if (e.which === 13) {
			sendMessage();
		}
	});

	function sendMessage() {
		let input = $("#chat-input-box");
		let message = input.val().trim();
		if (!message) return;

		// Append immediately
		$("#chat-messages").append(`<div class="user-message">${message}</div>`);
		$("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);

		// Save to backend
		frappe.call({
			method: "nextgenie.nextgenie.page.nextgenie.nextgenie.add_chat_message",
			args: {
				sender: "User",
				message: message
			}
		});

		input.val("");

		// For now, add dummy Genie reply to history
		let genie_reply = "🤖 Thanks for your message!";
		setTimeout(() => {
			$("#chat-messages").append(`<div class="bot-message">${genie_reply}</div>`);
			$("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);

			// Save bot reply
			frappe.call({
				method: "nextgenie.nextgenie.page.nextgenie.nextgenie.add_chat_message",
				args: {
					sender: "Genie",
					message: genie_reply
				}
			});
		}, 500);
	}
};
