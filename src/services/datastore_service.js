const crypto = require("crypto");
const { createRegistration, updateRegistrationStatus } = require("../models/registration");
const { createPaymentTransaction } = require("../models/payment_transaction");

function createDatastoreService({ store, logger } = {}) {
  const registrations = new Map();
  const paymentsById = new Map();
  const paymentsByRegistration = new Map();
  const paymentsByGatewayReference = new Map();
  const sink = logger || console;

  function generateGatewayReference() {
    if (typeof crypto.randomUUID === "function") {
      return `gw_${crypto.randomUUID()}`;
    }
    return `gw_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
  }

  function ensureGatewayReferenceUnique(gatewayReference) {
    const reference = String(gatewayReference || "").trim();
    if (!reference) {
      return { ok: true };
    }

    if (
      (store && typeof store.findPaymentByGatewayReference === "function" &&
        store.findPaymentByGatewayReference(reference)) ||
      paymentsByGatewayReference.has(reference)
    ) {
      return { ok: false, error: "duplicate_gateway_reference" };
    }

    return { ok: true };
  }

  function getRegistrationById(registrationId) {
    const id = String(registrationId || "").trim();
    if (!id) {
      return null;
    }

    if (store && typeof store.getRegistrationById === "function") {
      const record = store.getRegistrationById(id);
      return record ? createRegistration(record) : null;
    }

    return registrations.get(id) || null;
  }

  function saveRegistration(registration) {
    if (!registration || !registration.registration_id) {
      return null;
    }

    if (store && typeof store.saveRegistration === "function") {
      return store.saveRegistration(registration);
    }

    registrations.set(registration.registration_id, registration);
    return registration;
  }

  function updateRegistrationStatusRecord({ registrationId, status, reasonCode, updatedAt } = {}) {
    if (store && typeof store.updateRegistrationStatus === "function") {
      return store.updateRegistrationStatus({ registrationId, status, reasonCode, updatedAt });
    }

    const existing = getRegistrationById(registrationId);
    if (!existing) {
      return null;
    }

    const updated = updateRegistrationStatus(existing, { status, reasonCode, updatedAt });
    registrations.set(updated.registration_id, updated);
    return updated;
  }

  function listPaymentTransactionsByRegistration(registrationId) {
    const id = String(registrationId || "").trim();
    if (!id) {
      return [];
    }

    if (store && typeof store.listPaymentTransactionsByRegistration === "function") {
      const records = store.listPaymentTransactionsByRegistration(id) || [];
      return records.map((record) => createPaymentTransaction(record));
    }

    const entries = paymentsByRegistration.get(id) || [];
    return entries.map((paymentId) => paymentsById.get(paymentId)).filter(Boolean);
  }

  function findPaymentByGatewayReference(reference) {
    const normalized = String(reference || "").trim();
    if (!normalized) {
      return null;
    }

    if (store && typeof store.findPaymentByGatewayReference === "function") {
      const record = store.findPaymentByGatewayReference(normalized);
      return record ? createPaymentTransaction(record) : null;
    }

    const paymentId = paymentsByGatewayReference.get(normalized);
    return paymentId ? paymentsById.get(paymentId) : null;
  }

  function createPaymentRecord(input = {}) {
    const payment = createPaymentTransaction(input);
    const uniqueCheck = ensureGatewayReferenceUnique(payment.gateway_reference);
    if (!uniqueCheck.ok) {
      const error = new Error("Duplicate gateway reference");
      error.code = "DUPLICATE_GATEWAY_REFERENCE";
      throw error;
    }

    if (store && typeof store.createPaymentTransaction === "function") {
      const saved = store.createPaymentTransaction(payment);
      return createPaymentTransaction(saved);
    }

    paymentsById.set(payment.payment_id, payment);
    if (payment.gateway_reference) {
      paymentsByGatewayReference.set(payment.gateway_reference, payment.payment_id);
    }

    if (payment.registration_id) {
      const list = paymentsByRegistration.get(payment.registration_id) || [];
      list.push(payment.payment_id);
      paymentsByRegistration.set(payment.registration_id, list);
    }

    return payment;
  }

  function updatePaymentRecord(paymentId, updates = {}) {
    if (store && typeof store.updatePaymentTransaction === "function") {
      const updated = store.updatePaymentTransaction(paymentId, updates);
      return updated ? createPaymentTransaction(updated) : null;
    }

    const existing = paymentsById.get(paymentId);
    if (!existing) {
      return null;
    }

    const updated = createPaymentTransaction({
      ...existing,
      ...updates,
      payment_id: existing.payment_id,
      registration_id: existing.registration_id,
      gateway_reference: existing.gateway_reference,
      created_at: existing.created_at,
    });

    paymentsById.set(paymentId, updated);
    return updated;
  }

  function getLatestPaymentRecord(registrationId) {
    const records = listPaymentTransactionsByRegistration(registrationId);
    if (records.length === 0) {
      return null;
    }

    return records
      .slice()
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
  }

  function savePaymentAndRegistration({ registrationId, paymentInput, newStatus, reasonCode, updatedAt } = {}) {
    if (store && typeof store.savePaymentAndRegistration === "function") {
      return store.savePaymentAndRegistration({ registrationId, paymentInput, newStatus, reasonCode, updatedAt });
    }

    let payment = null;
    let registration = null;

    try {
      payment = createPaymentRecord(paymentInput);
    } catch (error) {
      throw error;
    }

    try {
      registration = updateRegistrationStatusRecord({
        registrationId,
        status: newStatus,
        reasonCode,
        updatedAt,
      });
    } catch (error) {
      if (sink && typeof sink.warn === "function") {
        sink.warn(
          JSON.stringify({
            event: "payment_registration_update_failed",
            registration_id: registrationId,
            payment_id: payment && payment.payment_id,
            error: String(error && error.message ? error.message : "unknown"),
          })
        );
      }
    }

    return { payment, registration, consistency: "ordered" };
  }

  return {
    generateGatewayReference,
    ensureGatewayReferenceUnique,
    getRegistrationById,
    saveRegistration,
    updateRegistrationStatus: updateRegistrationStatusRecord,
    listPaymentTransactionsByRegistration,
    findPaymentByGatewayReference,
    createPaymentRecord,
    updatePaymentRecord,
    getLatestPaymentRecord,
    savePaymentAndRegistration,
  };
}

module.exports = {
  createDatastoreService,
};
