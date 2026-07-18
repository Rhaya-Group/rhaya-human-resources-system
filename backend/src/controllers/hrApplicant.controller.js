import prisma from "../config/database.js";

const takeLimit = 25;

export const listApplicants = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.applicant.findMany({
        where,
        skip: (page - 1) * takeLimit,
        take: takeLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cvFileUrl: true,
          createdAt: true,
          _count: { select: { applications: true } },
        },
      }),
      prisma.applicant.count({ where }),
    ]);

    return res.json({ items, page, pageSize: takeLimit, total });
  } catch (error) {
    console.error("List HR applicants error:", error);
    return res.status(500).json({ error: "Failed to fetch applicants" });
  }
};

export const getApplicant = async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cvFileUrl: true,
        parsedCv: true,
        createdAt: true,
        profileAnswers: {
          include: { question: { select: { id: true, text: true, type: true } } },
        },
        applications: {
          select: {
            id: true,
            stage: true,
            appliedAt: true,
            jobPosting: { select: { title: true } },
          },
          orderBy: { appliedAt: "desc" },
        },
      },
    });

    if (!applicant) return res.status(404).json({ error: "Applicant not found" });
    return res.json(applicant);
  } catch (error) {
    console.error("Get HR applicant error:", error);
    return res.status(500).json({ error: "Failed to fetch applicant" });
  }
};
