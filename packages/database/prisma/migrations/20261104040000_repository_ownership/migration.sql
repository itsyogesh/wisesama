-- Remove provider credentials and repository records with their owning account/project.
ALTER TABLE "RepositoryConnection" ADD CONSTRAINT "RepositoryConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepositoryConnectionAttempt" ADD CONSTRAINT "RepositoryConnectionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRepositorySource" ADD CONSTRAINT "ProjectRepositorySource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRepositorySource" ADD CONSTRAINT "ProjectRepositorySource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SecurityProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRepositorySource" ADD CONSTRAINT "ProjectRepositorySource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "RepositoryConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
