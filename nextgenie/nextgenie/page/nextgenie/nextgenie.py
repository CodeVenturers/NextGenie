# Copyright (c) 2025, Codeventurers and contributors
# For license information, please see license.txt

import frappe


@frappe.whitelist()
def get_chat_history():
    return [
        {"sender": "Genie", "message": "👋 Hi, I’m NextGenie!", "creation": "2025-01-01 10:00:00"},
        {"sender": "User", "message": "Hello Genie 😎", "creation": "2025-01-01 10:01:00"},
        {"sender": "Genie", "message": "How can I help you today?", "creation": "2025-01-01 10:02:00"}
    ]


@frappe.whitelist()
def add_chat_message(sender, message):
    return {"status": "ok", "note": "Message saved"}