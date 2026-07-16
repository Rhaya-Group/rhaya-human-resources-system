import { StageBadge } from "../../utils/stages.jsx";

function valueText(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value ?? "Not answered";
}

function Timeline({ rows, empty, render }) {
  if (!rows?.length) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <div className="relative space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-500">
      {rows.map((row, index) => (
        <div key={index} className="relative pl-8 text-sm">
          <span className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-blue-500" />
          {render(row)}
        </div>
      ))}
    </div>
  );
}

export function ProfileSection({ title, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-bold uppercase text-gray-700 mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function ParsedCvReadOnly({ cv = {} }) {
  const links = cv.links || {};
  return (
    <div className="space-y-4">
      <ProfileSection title="About">
        {cv.summary ? <p className="text-sm leading-6 whitespace-pre-wrap">{cv.summary}</p> : <p className="text-sm text-gray-400">No summary.</p>}
      </ProfileSection>
      <ProfileSection title="Work History">
        <Timeline rows={cv.work_history} empty="No work history." render={(row) => (
          <>
            <p className="font-semibold text-gray-900">{row.title || "Untitled role"}</p>
            <p>{row.company}</p>
            <p className="text-gray-500">{row.start || "?"} - {row.current ? "Present" : row.end || "?"}</p>
            {row.description && <p className="mt-1 text-gray-600 whitespace-pre-wrap">{row.description}</p>}
          </>
        )} />
      </ProfileSection>
      <ProfileSection title="Education">
        <Timeline rows={cv.education} empty="No education." render={(row) => (
          <>
            <p className="font-semibold text-gray-900">{row.institution || "Institution"}</p>
            <p>{row.degree}{row.field_of_study ? `, ${row.field_of_study}` : ""}</p>
            <p className="text-gray-500">{row.start || "?"} - {row.graduated ? row.end || "?" : "Present"}</p>
          </>
        )} />
      </ProfileSection>
      <ProfileSection title="Skills">
        {cv.skills?.length ? (
          <div className="flex flex-wrap gap-2">
            {cv.skills.map((skill, i) => (
              <span key={i} className="rounded-full bg-gray-100 px-3 py-1 text-sm">{skill.name} · {skill.level}</span>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No skills.</p>}
      </ProfileSection>
      <ProfileSection title="Languages">
        {cv.languages?.length ? (
          <div className="flex flex-wrap gap-2">
            {cv.languages.map((language, i) => (
              <span key={i} className="rounded-full bg-gray-100 px-3 py-1 text-sm">{language.language} · {language.proficiency}</span>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No languages.</p>}
      </ProfileSection>
      <ProfileSection title="Links">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          {["linkedin", "portfolio", "github"].map((key) => (
            <div key={key}>
              <p className="font-semibold capitalize text-gray-500">{key}</p>
              {links[key] ? <a href={links[key]} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{links[key]}</a> : <p className="text-gray-400">Not provided</p>}
            </div>
          ))}
        </div>
      </ProfileSection>
    </div>
  );
}

export function ProfileAnswersReadOnly({ answers = [] }) {
  return (
    <ProfileSection title="Common Profile Answers">
      {answers.length ? (
        <div className="space-y-3">
          {answers.map((answer) => (
            <div key={answer.id}>
              <p className="text-sm font-semibold text-gray-800">{answer.question?.text}</p>
              <p className="text-sm text-gray-600">{valueText(answer.value)}</p>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-gray-400">No common answers.</p>}
    </ProfileSection>
  );
}

export function ApplicationsReadOnly({ applications = [] }) {
  return (
    <ProfileSection title="Applications">
      {applications.length ? (
        <div className="space-y-2">
          {applications.map((application) => (
            <div key={application.id} className="flex items-center justify-between gap-3 rounded border border-gray-100 px-3 py-2 text-sm">
              <div>
                <p className="font-semibold text-gray-900">{application.jobPosting?.title}</p>
                <p className="text-xs text-gray-400">{new Date(application.appliedAt).toLocaleDateString()}</p>
              </div>
              <StageBadge stage={application.stage} />
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-gray-400">No applications yet.</p>}
    </ProfileSection>
  );
}
