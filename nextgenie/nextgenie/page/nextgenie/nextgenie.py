# Copyright (c) 2025, Codeventurers and contributors
# For license information, please see license.txt

import frappe
import requests
from datetime import datetime


# ── Session Management ────────────────────────────────────────


@frappe.whitelist()
def get_sessions():
    """Return all chat sessions for the current user, newest first."""
    sessions = frappe.get_all(
        "Genie Chat Session",
        filters={"owner": frappe.session.user},
        fields=["name as id", "title", "creation"],
        order_by="creation desc",
        limit=30
    )
    for s in sessions:
        s["date"] = _friendly_date(s["creation"])
    return sessions


@frappe.whitelist()
def create_session():
    """Create a new chat session and return it."""
    doc = frappe.get_doc({
        "doctype": "Genie Chat Session",
        "title": "New Chat",
        "owner": frappe.session.user
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {
        "id":    doc.name,
        "title": doc.title,
        "date":  "Just now"
    }


@frappe.whitelist()
def update_session_title(session_id, title):
    """Rename a session."""
    frappe.db.set_value("Genie Chat Session", session_id, "title", title)
    frappe.db.commit()
    return {"status": "ok"}


# ── Message Management ────────────────────────────────────────


@frappe.whitelist()
def get_session_messages(session_id):
    """Return all messages for a session."""
    return frappe.get_all(
        "Genie Chat Message",
        filters={"session": session_id},
        fields=["sender", "message", "creation"],
        order_by="creation asc"
    )


@frappe.whitelist()
def add_chat_message(session_id, sender, message):
    """Save a single chat message."""
    doc = frappe.get_doc({
        "doctype": "Genie Chat Message",
        "session": session_id,
        "sender":  sender,
        "message": message
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"status": "ok"}


@frappe.whitelist()
def clear_session_messages(session_id):
    """Delete all messages in a session."""
    frappe.db.delete("Genie Chat Message", {"session": session_id})
    frappe.db.commit()
    return {"status": "ok"}


# ── AI Reply ──────────────────────────────────────────────────


@frappe.whitelist()
def get_ai_reply(session_id, message):
    """
    Get AI reply from local Ollama model.
    Ollama must be running: ollama serve
    Model must be pulled:   ollama pull phi3:mini
    """

    # Build conversation history for context
    history = frappe.get_all(
        "Genie Chat Message",
        filters={"session": session_id},
        fields=["sender", "message"],
        order_by="creation asc",
        limit=20  # last 20 messages as context
    )

    # Format history as prompt context
    context = ""
    for msg in history:
        role = "User" if msg["sender"] == "User" else "Assistant"
        context += f"{role}: {msg['message']}\n"
    context += f"User: {message}\nAssistant:"

    system_prompt = """You are NextGenie, a helpful and professional HR assistant.
You help employees with leave management, payroll queries, attendance,
onboarding, company policies, and HR-related questions.
Always be polite, concise, and accurate. If you don't know something,
say so and suggest contacting the HR team directly."""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model":  "phi3:mini",   # change to your pulled model
                "system": system_prompt,
                "prompt": context,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 300
                }
            },
            timeout=60
        )
        data = response.json()
        reply = data.get("response", "").strip()
        if not reply:
            reply = "I'm here to help. Could you clarify your question?"
        return {"reply": reply}

    except requests.exceptions.ConnectionError:
        return {"reply": "⚠️ Local AI is offline. Please start Ollama: `ollama serve`"}
    except Exception as e:
        frappe.log_error(str(e), "NextGenie AI Error")
        return {"reply": "⚠️ Something went wrong. Please try again."}


# ── Utils ─────────────────────────────────────────────────────


def _friendly_date(creation):
    """Convert creation datetime to a friendly label."""
    if not creation:
        return ""
    # creation may be a string from frappe — parse it
    if isinstance(creation, str):
        try:
            creation = datetime.strptime(creation, "%Y-%m-%d %H:%M:%S.%f")
        except ValueError:
            creation = datetime.strptime(creation, "%Y-%m-%d %H:%M:%S")
    now   = datetime.now()
    delta = now - creation
    total_seconds = int(delta.total_seconds())
    if total_seconds < 60:
        return "Just now"
    elif total_seconds < 3600:
        mins = total_seconds // 60
        return f"{mins}m ago"
    elif total_seconds < 86400:
        hrs = total_seconds // 3600
        return f"{hrs}h ago"
    elif total_seconds < 172800:
        return "Yesterday"
    elif delta.days < 7:
        return f"{delta.days} days ago"
    else:
        return creation.strftime("%d %b %Y")