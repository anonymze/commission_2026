import type { Media } from "./media";
import type { Supplier } from "./supplier";
import type { AppUser, User } from "./user";

export interface Commission {
  id: string;
  app_user: AppUser["user"];
  date: string;
  commission_suppliers: CommissionSupplier[];
  pdf?: Media | null;
  structured_product?: boolean | null;
  title?: string | null;
  up_front?: number | null;
  broqueur?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface CommissionSupplier {
  id: string;
  supplier: Supplier;
  encours: number;
  production: number;
  updatedAt: string;
  createdAt: string;
}

export interface AppUsersCommissionsCode {
  id: string;
  app_user: User;
  code: {
    code: string;
    id?: string | null;
    supplier?: Supplier;
  }[];
  updatedAt: string;
  createdAt: string;
}

export interface SuppliersCommissionsColumn {
  id: string;
  supplier: string | Supplier;
  production?: {
    subcode_column?: string | null;
    verification_column?: string | null;
    amount_column?: string | null;
  };
  encours?: {
    subcode_column?: string | null;
    verification_column?: string | null;
    amount_column?: string | null;
  };
  production_encours?: {
    production_subcode_column?: string | null;
    production_verification_column?: string | null;
    production_amount_column?: string | null;
    encours_subcode_column?: string | null;
    encours_verification_column?: string | null;
    encours_amount_column?: string | null;
  };
  updatedAt: string;
  createdAt: string;
}

export interface CommissionImport {
  id: string;
  supplier: string | Supplier;
  files: {
    file: string | Media;
    id?: string | null;
  }[];
  entry: "production" | "encours" | "production_encours";
  updatedAt: string;
  createdAt: string;
}

// Success response
interface SuccessResponseCommission {
  status: "success";
  message: string;
  data: {
    commission: {
      id: string;
      app_user: string;
      date: string;
    };
    totals: {
      production: number;
      encours: number;
    };
    commissionSuppliers: Array<{
      id: string;
      supplier: Supplier; // supplier ID
      production: number;
      encours: number;
      sheet_lines: Array<{
        rowIndex: number;
        subcode: string;
        amount: number;
        verificationKeyword: string;
        fullRow: any[];
        type?: 'production' | 'encours';
      }>;
    }>;
  };
}

// Error response
interface ErrorResponseCommission {
  status: "error";
  message: string;
  code?:
    | "NO_USER_CODES"
    | "NO_IMPORTS"
    | "VALIDATION_ERRORS"
    | "NO_COMMISSION_SUPPLIERS"
    | "INTERNAL_ERROR";
  errors?: string[];
}

export type ProcessCommissionsResponse =
  | SuccessResponseCommission
  | ErrorResponseCommission;
