import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import apiClient from "../../api/client";
import { ApplicationsReadOnly, ParsedCvReadOnly, ProfileAnswersReadOnly } from "./CandidateProfileReadOnly.jsx";

export default function CandidatePool() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["candidatePool", search],
    queryFn: async () => (await apiClient.get("/hr/applicants", { params: { search } })).data,
  });
  const candidates = data?.items || [];

  const { data: detail } = useQuery({
    queryKey: ["candidateDetail", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => (await apiClient.get(`/hr/applicants/${selectedId}`)).data,
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Candidate Pool</h1>
        <p className="text-sm text-gray-500 mt-1">All registered recruitment candidates, including candidates who have not applied yet.</p>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>
          {isLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading...</p>
          ) : candidates.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No candidates found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedId(candidate.id)}
                  className={`w-full text-left p-4 hover:bg-blue-50 ${selectedId === candidate.id ? "bg-blue-50" : ""}`}
                >
                  <p className="font-semibold text-gray-900">{candidate.name}</p>
                  <p className="text-sm text-gray-500 truncate">{candidate.email}</p>
                  <p className="text-xs text-gray-400 mt-1">{candidate._count?.applications || 0} application(s)</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          {!selectedId ? (
            <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-400">
              Select a candidate to view their profile.
            </div>
          ) : !detail ? (
            <p className="text-sm text-gray-500">Loading profile...</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{detail.name}</h2>
                    <p className="text-sm text-gray-600">{detail.email}{detail.phone ? ` · ${detail.phone}` : ""}</p>
                    <p className="text-xs text-gray-400 mt-1">Registered {new Date(detail.createdAt).toLocaleDateString()}</p>
                  </div>
                  {detail.cvFileUrl && (
                    <a href={detail.cvFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                      View CV <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <ParsedCvReadOnly cv={detail.parsedCv || {}} />
              <ProfileAnswersReadOnly answers={detail.profileAnswers || []} />
              <ApplicationsReadOnly applications={detail.applications || []} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
