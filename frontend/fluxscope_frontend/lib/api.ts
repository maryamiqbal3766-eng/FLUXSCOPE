const API_BASE_URL = "http://localhost:8000";

export type HealthResponse = {
  status: string;
};

export type ShockCandidate = {
  shock_id: string;
  shock_type: string;
  variable: string;
  direction_or_change: string;
  magnitude: number | null;
  unit: string | null;
  effective_date: string | null;
  source_evidence: unknown[];
  potential_dependencies: string[];
  status: string;
  verification_status: string;
};

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Backend health check failed: ${response.status}`);
  }

  return response.json();
}

export async function detectEconomicShocks(
  payload: {
    title: string;
    publisher: string;
    content: string;
    source_url?: string;
    source_domain?: string;
  },
): Promise<ShockCandidate[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/detect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Economic shock detection failed: ${response.status}`);
  }

  return response.json();
}