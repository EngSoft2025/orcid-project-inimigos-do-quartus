import { type NextRequest, NextResponse } from "next/server";
import { makeAuthenticatedOrcidRequest } from "@/lib/orcid-auth";
import {
  enrichWithExternalData,
  formatDataOrDash,
} from "@/lib/academic-platforms";

interface Publication {
  title: string;
  year: number;
  journal: string;
  citations: number | string;
  doi?: string;
}

interface Employment {
  organization: string;
  role: string;
  startDate?: string;
  endDate?: string;
}

interface Education {
  organization: string;
  degree: string;
  year?: string;
}

interface ResearcherProfile {
  orcidId: string;
  name: string;
  country: string;
  email?: string;
  website?: string;
  keywords: string[];
  publications: Publication[];
  totalCitations: number | string;
  hIndex: number | string;
  biography?: string;
  employments: Employment[];
  educations: Education[];
  enhancedWith?: string[];
}

// Cache for detailed profiles
const detailedProfileCache = new Map<string, any>();
const DETAILED_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for detailed profiles

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const orcidId = id;

    if (!orcidId) {
      return NextResponse.json(
        { error: "ORCID ID is required" },
        { status: 400 }
      );
    }

    console.log(`Fetching detailed profile for ORCID ID: ${orcidId}`);

    // Check cache first
    const cacheKey = `detailed_${orcidId}`;
    const cached = detailedProfileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DETAILED_CACHE_DURATION) {
      console.log(`Using cached detailed profile for ${orcidId}`);
      return NextResponse.json(cached.data);
    }

    // Use parallel requests for better performance with increased timeouts
    const timeoutMs = 12000; // 12 seconds for detailed profile

    const [
      profileResponse,
      employmentsResponse,
      educationsResponse,
      worksResponse,
    ] = await Promise.allSettled([
      Promise.race([
        makeAuthenticatedOrcidRequest(
          `https://pub.orcid.org/v3.0/${orcidId}/person`
        ),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Profile timeout")), timeoutMs)
        ),
      ]),
      Promise.race([
        makeAuthenticatedOrcidRequest(
          `https://pub.orcid.org/v3.0/${orcidId}/employments`
        ),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Employments timeout")), timeoutMs)
        ),
      ]),
      Promise.race([
        makeAuthenticatedOrcidRequest(
          `https://pub.orcid.org/v3.0/${orcidId}/educations`
        ),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Educations timeout")), timeoutMs)
        ),
      ]),
      Promise.race([
        makeAuthenticatedOrcidRequest(
          `https://pub.orcid.org/v3.0/${orcidId}/works`
        ),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Works timeout")), timeoutMs)
        ),
      ]),
    ]);

    // Check if main profile request succeeded
    if (
      profileResponse.status === "rejected" ||
      (profileResponse.status === "fulfilled" && !profileResponse.value.ok)
    ) {
      console.error(`Profile request failed for ${orcidId}`);
      return NextResponse.json(
        { error: "Researcher not found" },
        { status: 404 }
      );
    }

    const profileData = await profileResponse.value.json();

    // Process profile data with better error handling
    const name = extractName(profileData);
    const biography = profileData.biography?.content || "";

    // Extract contact information
    const emails = profileData.emails?.email || [];
    const email = emails.length > 0 ? emails[0].email : undefined;

    const websites = profileData["researcher-urls"]?.["researcher-url"] || [];
    const website = websites.length > 0 ? websites[0]["url"]?.value : undefined;

    // Extract location
    const addresses = profileData.addresses?.address || [];
    const country =
      addresses.length > 0 ? addresses[0].country?.value : "País não informado";

    // Extract keywords with limit
    const keywordData = profileData.keywords?.keyword || [];
    const keywords = keywordData
      .slice(0, 15)
      .map((k: any) => k.content)
      .filter(Boolean);

    // Process employments with better error handling
    const employments: Employment[] = [];
    if (
      employmentsResponse.status === "fulfilled" &&
      employmentsResponse.value.ok
    ) {
      try {
        const employmentsData = await employmentsResponse.value.json();
        const employmentGroups = employmentsData["employment-summary"] || [];

        for (const emp of employmentGroups.slice(0, 10)) {
          employments.push({
            organization: emp.organization?.name || "Organização não informada",
            role: emp["role-title"] || "Cargo não informado",
            startDate: formatDate(emp["start-date"]),
            endDate: formatDate(emp["end-date"]),
          });
        }
      } catch (error) {
        console.error(`Error processing employments for ${orcidId}:`, error);
      }
    }

    // Process educations with better error handling
    const educations: Education[] = [];
    if (
      educationsResponse.status === "fulfilled" &&
      educationsResponse.value.ok
    ) {
      try {
        const educationsData = await educationsResponse.value.json();
        const educationGroups = educationsData["education-summary"] || [];

        for (const edu of educationGroups.slice(0, 10)) {
          educations.push({
            organization: edu.organization?.name || "Instituição não informada",
            degree: edu["role-title"] || "Grau não informado",
            year: edu["end-date"]?.year?.value?.toString() || undefined,
          });
        }
      } catch (error) {
        console.error(`Error processing educations for ${orcidId}:`, error);
      }
    }

    // Process publications with enhanced approach
    let publications: Publication[] = [];
    let orcidPublicationCount = 0;

    if (worksResponse.status === "fulfilled" && worksResponse.value.ok) {
      try {
        const worksData = await worksResponse.value.json();
        const workGroups = worksData.group || [];
        orcidPublicationCount = workGroups.length;

        console.log(
          `Processing ${Math.min(workGroups.length, 50)} works for ${orcidId}`
        );

        // Process works in smaller batches for better performance
        const batchSize = 10;
        const maxWorks = 50; // Limit to prevent timeout

        for (
          let i = 0;
          i < Math.min(workGroups.length, maxWorks);
          i += batchSize
        ) {
          const batch = workGroups.slice(i, i + batchSize);

          const batchPromises = batch.map(async (group: any) => {
            const workSummary = group["work-summary"]?.[0];
            if (!workSummary) return null;

            try {
              // Try to get detailed work info with timeout
              const workDetailResponse = await Promise.race([
                makeAuthenticatedOrcidRequest(
                  `https://pub.orcid.org/v3.0/${orcidId}/work/${workSummary["put-code"]}`
                ),
                new Promise<Response>((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Work detail timeout")),
                    8000
                  )
                ),
              ]);

              if (workDetailResponse.ok) {
                const workDetail = await workDetailResponse.json();
                return processWorkDetail(workDetail, workSummary);
              } else {
                // Fallback to summary data
                return processWorkSummary(workSummary);
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
              console.log(
                `Failed to get detail for work, using summary:`,
                errorMessage
              );
              return processWorkSummary(workSummary);
            }
          });

          const batchResults = await Promise.allSettled(batchPromises);
          batchResults.forEach((result) => {
            if (result.status === "fulfilled" && result.value) {
              publications.push(result.value);
            }
          });

          // Small delay between batches
          if (i + batchSize < Math.min(workGroups.length, maxWorks)) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      } catch (error) {
        console.error(`Error processing works for ${orcidId}:`, error);
      }
    }

    console.log(
      `Extracted ${publications.length} publications from ORCID for ${orcidId}`
    );

    // Enrich data with external academic platforms
    let enrichedData: any = {
      publications,
      totalCitations: "-",
      hIndex: "-",
      enhancedWith: [],
    };

    try {
      console.log(
        `Starting enrichment for ${name} with ${publications.length} publications`
      );
      enrichedData = await Promise.race([
        enrichWithExternalData(name, {
          publications,
          totalCitations: 0,
          hIndex: 0,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Enrichment timeout")), 15000)
        ),
      ]);

      // Ensure publications have proper citation data
      if (enrichedData.publications && enrichedData.publications.length > 0) {
        enrichedData.publications = enrichedData.publications.map(
          (pub: Publication) => ({
            ...pub,
            citations: formatDataOrDash(pub.citations),
          })
        );
        console.log(
          `Publications enriched: ${
            enrichedData.publications.filter(
              (p: Publication) => p.citations !== "-" && p.citations !== 0
            ).length
          } have citation data`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(
        `Enrichment failed for ${name}, using ORCID data only:`,
        errorMessage
      );

      // Even if enrichment fails, format the citations properly
      publications = publications.map((pub) => ({
        ...pub,
        citations: formatDataOrDash(pub.citations),
      }));
    }

    console.log(
      `Profile enriched with data from: ${
        enrichedData.enhancedWith?.join(", ") || "ORCID only"
      }`
    );

    const profile: ResearcherProfile = {
      orcidId,
      name,
      country,
      email,
      website,
      keywords,
      publications: enrichedData.publications || publications,
      totalCitations: enrichedData.totalCitations || "-",
      hIndex: enrichedData.hIndex || "-",
      biography,
      employments,
      educations,
      enhancedWith: enrichedData.enhancedWith || [],
    };

    // Cache the result
    detailedProfileCache.set(cacheKey, {
      data: profile,
      timestamp: Date.now(),
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching researcher profile:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        message: "Falha ao carregar perfil do pesquisador. Tente novamente.",
      },
      { status: 500 }
    );
  }
}

function extractName(profileData: any): string {
  const givenNames = profileData.name?.["given-names"]?.value || "";
  const familyName = profileData.name?.["family-name"]?.value || "";
  const creditName = profileData.name?.["credit-name"]?.value || "";

  const fullName = `${givenNames} ${familyName}`.trim();
  return fullName || creditName || "Nome não disponível";
}

function formatDate(dateObj: any): string | undefined {
  if (!dateObj) return undefined;

  const year = dateObj.year?.value;
  const month = dateObj.month?.value;

  if (year) {
    return month
      ? `${year}/${month.toString().padStart(2, "0")}`
      : year.toString();
  }

  return undefined;
}

function processWorkDetail(workDetail: any, workSummary: any): Publication {
  const title =
    workDetail.title?.title?.value ||
    workSummary.title?.title?.value ||
    "Título não disponível";

  const year =
    workDetail["publication-date"]?.year?.value ||
    workSummary["publication-date"]?.year?.value ||
    new Date().getFullYear();

  const journal =
    workDetail["journal-title"]?.value ||
    workSummary["journal-title"]?.value ||
    "Revista não informada";

  // Extract DOI
  const externalIds = workDetail["external-ids"]?.["external-id"] || [];
  const doiId = externalIds.find((id: any) => id["external-id-type"] === "doi");
  const doi = doiId?.["external-id-value"];

  return {
    title,
    year,
    journal,
    citations: 0, // Will be enhanced by external data
    doi,
  };
}

function processWorkSummary(workSummary: any): Publication {
  const title = workSummary.title?.title?.value || "Título não disponível";
  const year =
    workSummary["publication-date"]?.year?.value || new Date().getFullYear();
  const journal =
    workSummary["journal-title"]?.value || "Revista não informada";

  return {
    title,
    year,
    journal,
    citations: 0, // Will be enhanced by external data
    doi: undefined,
  };
}
