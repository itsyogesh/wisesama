'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wisesama-api.vercel.app';

const scamTypes = [
  { value: 'phishing', label: 'Phishing' },
  { value: 'ponzi', label: 'Ponzi Scheme' },
  { value: 'fake-exchange', label: 'Fake Exchange' },
  { value: 'rug-pull', label: 'Rug Pull' },
  { value: 'scam', label: 'Scam' },
  { value: 'other', label: 'Other' },
];

export default function ReportPage() {
  const [formData, setFormData] = useState({
    scamType: '',
    address: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!formData.address.trim()) {
      toast.error('Please enter an address');
      return;
    }
    if (!formData.scamType) {
      toast.error('Please select a scam type');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: formData.address.trim(),
          category: formData.scamType,
          description: formData.description,
        }),
      });

      if (res.ok) {
        toast.success('Report submitted successfully!');
        router.push('/');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Failed to submit report');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="min-h-screen bg-[#1A1A1A]"
      style={{
        backgroundImage: 'url(/allbg.png)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      <main className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Illustration */}
            <motion.div
              initial={{ opacity: 0, x: -70 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative hidden lg:block"
            >
              <div className="relative w-full h-96">
                <Image
                  src="/report.png"
                  alt="Security Warning Illustration"
                  width={699}
                  height={584}
                  className="object-contain floating-animation"
                />
              </div>
            </motion.div>

            {/* Right Form */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Card className="bg-gray-900/80 border border-gray-800 backdrop-blur-sm shadow-xl">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h1 className="font-heading font-bold text-2xl text-white">
                        File Scam <span className="text-red-400">Report</span>
                      </h1>
                      <p className="text-gray-400 text-sm">
                        Help us build knowledge entities in the Dotsama
                        ecosystem by filling the form below!
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Scam Type */}
                      <div className="space-y-2">
                        <label className="text-white font-medium">Scam Type</label>
                        <Select
                          onValueChange={(value) =>
                            setFormData({ ...formData, scamType: value })
                          }
                        >
                          <SelectTrigger className="bg-gray-800 border border-gray-700 text-white">
                            <SelectValue placeholder="Select a scam type" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            {scamTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Address */}
                      <div className="space-y-2">
                        <label className="text-white font-medium">
                          Scam Address
                        </label>
                        <Input
                          placeholder="1fqgWAVR7dAaJJVH2mZ2gC4hqceMi..."
                          value={formData.address}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: e.target.value,
                            })
                          }
                          className="bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <label className="text-white font-medium">
                          Description
                        </label>
                        <Textarea
                          placeholder={`COMPANY NAME\nSTOLEN AMOUNT\nTRANSACTION ID\nCONTACT DETAILS (IF ANY)`}
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          className="bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 min-h-[120px]"
                        />
                      </div>

                      {/* Button */}
                      <div>
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            className="w-[120px] h-[54px] bg-red-600 hover:bg-red-700 text-white font-semibold text-lg px-6 py-3 rounded-lg"
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Submitting...' : 'Report'}
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </section>
  );
}
