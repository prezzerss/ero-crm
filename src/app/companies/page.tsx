import { supabase } from "@/lib/supabase";

export default async function CompaniesPage() {
    const { data: companies, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

    if(error) {
        return <p className="p-8">Error loading companies: {error.message}</p>;
    }

    return (
        <main className="min-h-screen p-8">
            <h1 className="text-3xl font-bold mb-6">Companies</h1>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Sector</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Website</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companies?.map((company) => (
                            <tr key={company.id} className="border-t">
                                <td className="p-4 font-medium">{company.name}</td>
                                <td className="p-4">{company.sector || "-"}</td>
                                <td className="p-4">{company.status || "-"}</td>
                                <td className="p-4">
                                    {company.website ? (
                                        <a
                                            href={company.website}
                                            className="underline"
                                            target="_blank"
                                        >
                                            Visit
                                        </a>
                                    ) : (
                                        "-"
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
}