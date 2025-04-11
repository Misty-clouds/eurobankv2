'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Bell } from 'lucide-react';
import { useRouter } from '@/i18n/routing';

// Define the type for an announcement
interface Announcement {
  id: number;
  title: string;
  description: string;
  timestamp: string;
}

const AnnouncementPage: React.FC = () => {
  const supabase = createClient();
  const router = useRouter();
  const back = ()=>{
    router.back();
  }

  // State to store announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Fetch announcements from the database on component mount
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('announcement') 
          .select('*')
          .order('created_at', { ascending: false }); // Order by latest announcements

        if (error) {
          console.error('Error fetching announcements:', error);
        } else {
          setAnnouncements(data || []); // Set data or fallback to an empty array
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
      }
    };

    fetchAnnouncements();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button onClick={back} className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-primary font-bold">Announcements</h1>
          </div>
        </div>

        {/* Announcement Overview */}
        <div className="bg-blue-900/50 backdrop-blur-md p-6 mb-8 rounded-2xl border border-blue-700/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <Bell className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">Latest Updates</h2>
          <p className="text-muted-foreground text-center">
            Stay informed about our latest news and updates
          </p>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.length > 0 ? (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 border border-blue-700/50 hover:border-blue-600/50 transition-colors"
              >
                <h3 className="text-xl font-semibold text-primary mb-3">
                  {announcement.title}
                </h3>
                <p className="text-muted-foreground">
                  {announcement.description.split(' ').map((word, index) => {
                  const isLink = word.startsWith('http://') || word.startsWith('https://');
                  return isLink ? (
                    <a
                    key={index}
                    href={word}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                    >
                    {word}
                    </a>
                  ) : (
                    <span key={index}>{word} </span>
                  );
                  })}
                </p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center">No announcements available at the moment.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementPage;
