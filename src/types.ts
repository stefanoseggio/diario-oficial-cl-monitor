export type SectionName =
    | 'normas_generales'
    | 'avisos_destacados'
    | 'marcas_patentes'
    | 'normas_particulares'
    | 'publicaciones_judiciales'
    | 'empresas_cooperativas'
    | 'bom';

export interface ActorInput {
    sections: SectionName[];
    maxItems: number;
}

export interface GazetteEntry {
    rama: string | null;
    ministerio: string | null;
    organismo: string | null;
    descripcion: string;
    pdfUrl: string | null;
    cve: string | null;
    seccion: SectionName;
    edicion: string;
    fecha: string;
    scrapedAt: string;
}
