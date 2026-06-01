// frontend/src/hooks/useInternalPolicyUrl.js
import { useState, useEffect } from "react";
import apiClient from "../api/client";

const DEFAULT_POLICY_URL = "https://rhayaflicks.com/internalpolicy/";
const DEFAULT_POLICY_LABEL = "Internal Policy";

export function useInternalPolicyUrl() {
  const [url, setUrl] = useState(DEFAULT_POLICY_URL);
  const [label, setLabel] = useState(DEFAULT_POLICY_LABEL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // ✅ Updated to new endpoint (was /entity-policies/my-policy-url)
    apiClient
      .get("/policy-templates/my-policy-url")
      .then((res) => {
        if (cancelled) return;
        setUrl(res.data.data?.url || DEFAULT_POLICY_URL);
        setLabel(res.data.data?.label || DEFAULT_POLICY_LABEL);
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(DEFAULT_POLICY_URL);
          setLabel(DEFAULT_POLICY_LABEL);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { url, label, loading };
}
