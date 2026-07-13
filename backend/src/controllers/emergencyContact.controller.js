// backend/src/controllers/emergencyContact.controller.js
import prisma from "../config/database.js";

/**
 * List emergency contacts for a user
 * GET /api/users/:userId/emergency-contacts
 * Self or HR (Level 1-2)
 */
export const getEmergencyContacts = async (req, res) => {
  try {
    const { userId } = req.params;
    const isAdmin = req.user.accessLevel <= 2;
    const isSelf = req.user.id === userId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Access denied" });
    }

    const contacts = await prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ success: true, data: contacts });
  } catch (error) {
    console.error("Get emergency contacts error:", error);
    return res.status(500).json({
      error: "Failed to fetch emergency contacts",
      message: error.message,
    });
  }
};

/**
 * Add an emergency contact
 * POST /api/users/:userId/emergency-contacts
 * Self only
 */
export const createEmergencyContact = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, relationship, phone } = req.body;

    if (req.user.id !== userId) {
      return res.status(403).json({ error: "You can only manage your own emergency contacts" });
    }

    if (!name || !relationship || !phone) {
      return res.status(400).json({ error: "Name, relationship, and phone are required" });
    }

    const contact = await prisma.emergencyContact.create({
      data: { userId, name, relationship, phone },
    });

    return res.status(201).json({ success: true, data: contact });
  } catch (error) {
    console.error("Create emergency contact error:", error);
    return res.status(500).json({
      error: "Failed to create emergency contact",
      message: error.message,
    });
  }
};

/**
 * Update an emergency contact
 * PUT /api/users/:userId/emergency-contacts/:contactId
 * Self only
 */
export const updateEmergencyContact = async (req, res) => {
  try {
    const { userId, contactId } = req.params;
    const { name, relationship, phone } = req.body;

    if (req.user.id !== userId) {
      return res.status(403).json({ error: "You can only manage your own emergency contacts" });
    }

    const existing = await prisma.emergencyContact.findFirst({
      where: { id: contactId, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Emergency contact not found" });
    }

    const updated = await prisma.emergencyContact.update({
      where: { id: contactId },
      data: {
        ...(name && { name }),
        ...(relationship && { relationship }),
        ...(phone && { phone }),
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update emergency contact error:", error);
    return res.status(500).json({
      error: "Failed to update emergency contact",
      message: error.message,
    });
  }
};

/**
 * Delete an emergency contact
 * DELETE /api/users/:userId/emergency-contacts/:contactId
 * Self only
 */
export const deleteEmergencyContact = async (req, res) => {
  try {
    const { userId, contactId } = req.params;

    if (req.user.id !== userId) {
      return res.status(403).json({ error: "You can only manage your own emergency contacts" });
    }

    const existing = await prisma.emergencyContact.findFirst({
      where: { id: contactId, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Emergency contact not found" });
    }

    await prisma.emergencyContact.delete({ where: { id: contactId } });

    return res.json({ success: true, message: "Emergency contact deleted" });
  } catch (error) {
    console.error("Delete emergency contact error:", error);
    return res.status(500).json({
      error: "Failed to delete emergency contact",
      message: error.message,
    });
  }
};
