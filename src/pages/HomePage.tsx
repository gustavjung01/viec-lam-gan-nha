import { useState } from 'react';
import { ApplyModal } from '../components/ApplyModal';
import { AreasSection } from '../components/AreasSection';
import { DashboardPreview } from '../components/DashboardPreview';
import { HeroSearch } from '../components/HeroSearch';
import { JobsSection } from '../components/JobsSection';
import Chatbot from '../components/Chatbot';
import type { JobPost } from '../lib/types';

export function HomePage() {
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);

  return (
    <main>
      {selectedJob && <ApplyModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      <HeroSearch />
      <JobsSection onApply={setSelectedJob} />
      <AreasSection />
      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-6">
        <DashboardPreview />
      </section>
      <Chatbot />
    </main>
  );
}
