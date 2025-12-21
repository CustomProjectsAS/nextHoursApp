// Central types for Hours (admin)

export type HourStatusUi = "pending" | "pendingEmployee" | "approved" | "rejected";



export type AdminHourEntry = {
    id: number;
    date: string;
    from: string;
    to: string;
    breakLabel: string;
    hoursNet: number;
    projectName: string;
    projectColor: string;
    description: string;
    status: HourStatusUi;
};

export type AdminEmployeeHours = {
    id: number;
    name: string;
    entries: AdminHourEntry[];
};

export type AdminHoursData = {
    month: string;
    monthLabel: string;
    employees: AdminEmployeeHours[];
};

export type HoursTabProps = {
    data: AdminHoursData;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    monthNavBusy?: boolean;
};
