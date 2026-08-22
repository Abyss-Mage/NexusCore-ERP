export interface Printer {
    id: number;
    name: string;
    make: string;
    connection_type?: string;
    cloud_region?: string;
    serial_number?: string;
    ip_address?: string;
    status: "Active" | "Printing" | "Paused" | "Maintenance" | "Offline" | "Error" | string;
    progress?: number;
    nozzle_temp?: number;
    nozzle_target_temp?: number;
    bed_temp?: number;
    bed_target_temp?: number;
    layer_num?: number;
    total_layers?: number;
    remaining_minutes?: number;
    current_job?: string;
    hourly_rate: number;
    last_seen?: string;
}

export interface Filament {
    id: number;
    brand: string;
    material_type: string;
    color: string;
    color_hex?: string;
    initial_weight_grams: number;
    remaining_weight_grams: number;
    spool_price: number;
    cost_per_gram: number;
    density?: number;
    diameter_mm?: number;
    location?: string;
    status: "In Stock" | "Low Stock" | "Depleted" | string;
    created_at?: string;
    updated_at?: string;
}

export interface PrintJob {
    id: number;
    title: string;
    description?: string;
    status: "Pending" | "Printing" | "Done" | string;
    printer_id?: number;
    filament_id?: number;
    estimated_time_hours: number;
    filament_weight_grams: number;
    client_id?: number;
    total_cost: number;
    
    // Relations
    printer?: Printer;
    filament?: Filament;
    client?: {
        id: number;
        company_name?: string;
        name?: string;
    };
}

